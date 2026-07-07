<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

/** Customer reports against shops (order required). */
final class ShopReportService
{
    public const REASONS = [
        'no_delivery',
        'payment_ignored',
        'wrong_items',
        'pricing_scam',
        'harassment',
        'counterfeit',
        'other',
    ];

    /** @return array<string,mixed> */
    public static function create(PDO $pdo, int $userId, int $orderId, string $reason, string $description): array
    {
        $reason = trim($reason);
        if (!in_array($reason, self::REASONS, true)) {
            throw new RuntimeException('Invalid report reason.');
        }
        $description = trim($description);
        if (strlen($description) < 10) {
            throw new RuntimeException('Please describe the issue (at least 10 characters).');
        }

        $stmt = $pdo->prepare(
            'SELECT o.id, o.user_id, o.storefront_shop_id, o.payment_collector
             FROM orders o WHERE o.id = ? LIMIT 1'
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false || (int) $order['user_id'] !== $userId) {
            throw new RuntimeException('Order not found.');
        }

        $shopId = (int) ($order['storefront_shop_id'] ?? 0);
        if ($shopId <= 0) {
            $shopStmt = $pdo->prepare(
                'SELECT DISTINCT p.shop_id FROM order_items oi
                 INNER JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = ? AND p.shop_id IS NOT NULL LIMIT 1'
            );
            $shopStmt->execute([$orderId]);
            $shopId = (int) ($shopStmt->fetchColumn() ?: 0);
        }
        if ($shopId <= 0) {
            throw new RuntimeException('This order is not from a marketplace shop.');
        }

        if ($order['payment_status'] ?? '' === 'cancelled') {
            throw new RuntimeException('Cannot report a cancelled order.');
        }

        $dup = $pdo->prepare(
            'SELECT 1 FROM shop_reports WHERE reporter_user_id = ? AND order_id = ? AND status IN (\'open\', \'under_review\') LIMIT 1'
        );
        $dup->execute([$userId, $orderId]);
        if ($dup->fetchColumn() !== false) {
            throw new RuntimeException('You already have an open report for this order.');
        }

        $pdo->prepare(
            'INSERT INTO shop_reports (reporter_user_id, shop_id, order_id, reason, description)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([$userId, $shopId, $orderId, $reason, $description]);

        $reportId = (int) $pdo->lastInsertId();

        NotificationService::notifyAdmins(
            $pdo,
            'Shop report filed',
            "Order #{$orderId} — reason: {$reason}",
            '/admin/trust'
        );

        TrustAutomationService::onReportCreated($pdo, $shopId, $reportId);

        return self::findById($pdo, $reportId) ?? [];
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT r.*, s.name AS shop_name, s.slug AS shop_slug, u.name AS reporter_name, u.email AS reporter_email
             FROM shop_reports r
             INNER JOIN shops s ON s.id = r.shop_id
             INNER JOIN users u ON u.id = r.reporter_user_id
             WHERE r.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /** @return list<array<string,mixed>> */
    public static function listForAdmin(PDO $pdo, ?string $status = null, int $limit = 100): array
    {
        $limit = max(1, min($limit, 200));
        $sql = 'SELECT r.*, s.name AS shop_name, s.slug AS shop_slug, u.name AS reporter_name
                FROM shop_reports r
                INNER JOIN shops s ON s.id = r.shop_id
                INNER JOIN users u ON u.id = r.reporter_user_id';
        $params = [];
        if ($status !== null && in_array($status, ['open', 'under_review', 'resolved', 'dismissed'], true)) {
            $sql .= ' WHERE r.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY r.created_at DESC LIMIT ' . $limit;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function resolve(
        PDO $pdo,
        int $reportId,
        int $adminUserId,
        string $status,
        ?string $adminNote = null
    ): array {
        if (!in_array($status, ['resolved', 'dismissed', 'under_review'], true)) {
            throw new RuntimeException('Invalid status.');
        }

        $pdo->prepare(
            'UPDATE shop_reports SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?'
        )->execute([
            $status,
            $adminNote !== null && trim($adminNote) !== '' ? trim($adminNote) : null,
            in_array($status, ['resolved', 'dismissed'], true) ? $adminUserId : null,
            $reportId,
        ]);

        return self::findById($pdo, $reportId) ?? [];
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'reporter_user_id'=> (int) $row['reporter_user_id'],
            'reporter_name'   => $row['reporter_name'] ?? null,
            'reporter_email'  => $row['reporter_email'] ?? null,
            'shop_id'         => (int) $row['shop_id'],
            'shop_name'       => $row['shop_name'] ?? null,
            'shop_slug'       => $row['shop_slug'] ?? null,
            'order_id'        => (int) $row['order_id'],
            'reason'          => (string) $row['reason'],
            'description'     => (string) $row['description'],
            'status'          => (string) $row['status'],
            'admin_note'      => $row['admin_note'],
            'resolved_at'     => $row['resolved_at'],
            'created_at'      => $row['created_at'],
        ];
    }
}
