<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

final class ProductReviewService
{
    /** @return array<int,array<string,mixed>> */
    public static function listForProduct(PDO $pdo, int $productId, bool $publicOnly = true): array
    {
        $sql = 'SELECT r.*, u.name AS user_name
                FROM product_reviews r
                INNER JOIN users u ON u.id = r.user_id
                WHERE r.product_id = ?';
        if ($publicOnly) {
            $sql .= " AND r.status = 'approved'";
        }
        $sql .= ' ORDER BY r.created_at DESC LIMIT 100';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$productId]);

        return array_map(static fn (array $r): array => self::map($r), $stmt->fetchAll());
    }

    /** @return array<int,array<string,mixed>> */
    public static function listPending(PDO $pdo): array
    {
        $stmt = $pdo->query(
            "SELECT r.*, u.name AS user_name, p.name AS product_name, p.slug AS product_slug
             FROM product_reviews r
             INNER JOIN users u ON u.id = r.user_id
             INNER JOIN products p ON p.id = r.product_id
             WHERE r.status = 'pending'
             ORDER BY r.created_at ASC
             LIMIT 200"
        );

        return array_map(static fn (array $r): array => self::map($r), $stmt->fetchAll());
    }

    /** @param array<string,mixed> $body */
    public static function submit(PDO $pdo, int $userId, array $body): array
    {
        $productId = (int) ($body['product_id'] ?? 0);
        $orderId = isset($body['order_id']) ? (int) $body['order_id'] : null;
        $rating = (int) ($body['rating'] ?? 0);
        $title = trim((string) ($body['title'] ?? ''));
        $text = trim((string) ($body['body'] ?? ''));

        if ($productId <= 0 || $rating < 1 || $rating > 5) {
            throw new RuntimeException('Product and rating (1–5) are required.');
        }

        $verified = false;
        if ($orderId !== null && $orderId > 0) {
            $chk = $pdo->prepare(
                "SELECT 1 FROM order_items oi
                 INNER JOIN orders o ON o.id = oi.order_id
                 WHERE oi.order_id = ? AND oi.product_id = ? AND o.user_id = ?
                   AND o.status IN ('delivered','collected','shipped','processing','pending','payment_confirmed')"
            );
            $chk->execute([$orderId, $productId, $userId]);
            $verified = $chk->fetchColumn() !== false;
        }

        $pdo->prepare(
            'INSERT INTO product_reviews (product_id, user_id, order_id, rating, title, body, verified_purchase, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, \'pending\')
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title), body = VALUES(body),
                verified_purchase = VALUES(verified_purchase), status = \'pending\', updated_at = NOW()'
        )->execute([
            $productId,
            $userId,
            $orderId,
            $rating,
            $title !== '' ? $title : null,
            $text !== '' ? $text : null,
            $verified ? 1 : 0,
        ]);

        $id = (int) $pdo->lastInsertId();
        if ($id === 0) {
            $find = $pdo->prepare(
                'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ? AND order_id <=> ?'
            );
            $find->execute([$userId, $productId, $orderId]);
            $id = (int) $find->fetchColumn();
        }

        NotificationService::notifyAdmins(
            $pdo,
            'New product review pending',
            'Review for product #' . $productId,
            '/admin/reviews',
            'admin_reviews'
        );

        $stmt = $pdo->prepare('SELECT r.*, u.name AS user_name FROM product_reviews r INNER JOIN users u ON u.id = r.user_id WHERE r.id = ?');
        $stmt->execute([$id]);

        return self::map($stmt->fetch() ?: []);
    }

    public static function moderate(PDO $pdo, int $reviewId, string $status): void
    {
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new RuntimeException('Invalid status.');
        }
        $pdo->prepare('UPDATE product_reviews SET status = ? WHERE id = ?')->execute([$status, $reviewId]);

        $row = $pdo->prepare('SELECT product_id FROM product_reviews WHERE id = ?');
        $row->execute([$reviewId]);
        $productId = (int) $row->fetchColumn();
        if ($productId > 0 && $status === 'approved') {
            self::recalculateProductRating($pdo, $productId);
        }
    }

    public static function recalculateProductRating(PDO $pdo, int $productId): void
    {
        $stmt = $pdo->prepare(
            "SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM product_reviews
             WHERE product_id = ? AND status = 'approved'"
        );
        $stmt->execute([$productId]);
        $row = $stmt->fetch();
        $avg = $row !== false && $row['cnt'] > 0 ? round((float) $row['avg_r'], 1) : null;
        $cnt = $row !== false ? (int) $row['cnt'] : 0;

        $pdo->prepare('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?')
            ->execute([$avg, $cnt, $productId]);

        $shopStmt = $pdo->prepare('SELECT shop_id FROM products WHERE id = ?');
        $shopStmt->execute([$productId]);
        $shopId = $shopStmt->fetchColumn();
        if ($shopId !== false && (int) $shopId > 0) {
            self::recalculateShopRating($pdo, (int) $shopId);
        }
    }

    public static function recalculateShopRating(PDO $pdo, int $shopId): void
    {
        $stmt = $pdo->prepare(
            "SELECT AVG(r.rating) AS avg_r, COUNT(*) AS cnt
             FROM product_reviews r
             INNER JOIN products p ON p.id = r.product_id
             WHERE p.shop_id = ? AND r.status = 'approved'"
        );
        $stmt->execute([$shopId]);
        $row = $stmt->fetch();
        $avg = $row !== false && $row['cnt'] > 0 ? round((float) $row['avg_r'], 1) : null;
        $cnt = $row !== false ? (int) $row['cnt'] : 0;

        $pdo->prepare('UPDATE shops SET rating_avg = ?, rating_count = ? WHERE id = ?')
            ->execute([$avg, $cnt, $shopId]);
    }

    /** @param array<string,mixed> $body */
    public static function submitPlatformFeedback(PDO $pdo, ?int $userId, array $body): void
    {
        $rating = (int) ($body['rating'] ?? 0);
        $comment = trim((string) ($body['comment'] ?? ''));
        if ($rating < 1 || $rating > 5) {
            throw new RuntimeException('Rating 1–5 required.');
        }
        $pdo->prepare('INSERT INTO platform_feedback (user_id, rating, comment) VALUES (?, ?, ?)')
            ->execute([$userId, $rating, $comment !== '' ? $comment : null]);
    }

    /** @param array<string,mixed> $row */
    private static function map(array $row): array
    {
        return [
            'id'                => (int) ($row['id'] ?? 0),
            'product_id'        => (int) ($row['product_id'] ?? 0),
            'product_name'      => $row['product_name'] ?? null,
            'product_slug'      => $row['product_slug'] ?? null,
            'user_id'           => (int) ($row['user_id'] ?? 0),
            'user_name'         => $row['user_name'] ?? null,
            'order_id'          => isset($row['order_id']) ? (int) $row['order_id'] : null,
            'rating'            => (int) ($row['rating'] ?? 0),
            'title'             => $row['title'] ?? null,
            'body'              => $row['body'] ?? null,
            'status'            => $row['status'] ?? 'pending',
            'verified_purchase' => (int) ($row['verified_purchase'] ?? 0) === 1,
            'created_at'        => $row['created_at'] ?? null,
        ];
    }
}
