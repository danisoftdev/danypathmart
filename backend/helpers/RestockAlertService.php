<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Targeted restock notifications — product + optional club tag. */
final class RestockAlertService
{
    public static function subscribe(PDO $pdo, int $userId, int $productId, ?string $clubTag): void
    {
        $tag = self::normalizeTag($clubTag);
        $pdo->prepare(
            'INSERT INTO stock_alert_subscriptions (user_id, product_id, club_tag)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE club_tag = VALUES(club_tag), created_at = CURRENT_TIMESTAMP'
        )->execute([$userId, $productId, $tag]);
    }

    public static function unsubscribe(PDO $pdo, int $userId, int $productId, ?string $clubTag): void
    {
        $tag = self::normalizeTag($clubTag);
        $pdo->prepare(
            'DELETE FROM stock_alert_subscriptions
             WHERE user_id = ? AND product_id = ? AND club_tag <=> ?'
        )->execute([$userId, $productId, $tag]);
    }

    /**
     * @return array<int,array{club_tag:?string,subscribed:bool}>
     */
    public static function status(PDO $pdo, int $userId, int $productId): array
    {
        $stmt = $pdo->prepare(
            'SELECT club_tag FROM stock_alert_subscriptions WHERE user_id = ? AND product_id = ?'
        );
        $stmt->execute([$userId, $productId]);
        $rows = $stmt->fetchAll();

        if ($rows === []) {
            return [['club_tag' => null, 'subscribed' => false]];
        }

        return array_map(static fn (array $r): array => [
            'club_tag'   => $r['club_tag'],
            'subscribed' => true,
        ], $rows);
    }

    public static function notifyIfRestocked(PDO $pdo, int $productId, int $oldStock, int $newStock): void
    {
        if ($oldStock > 0 || $newStock <= 0) {
            return;
        }

        $product = $pdo->prepare('SELECT name, slug, tags, status FROM products WHERE id = ?');
        $product->execute([$productId]);
        $row = $product->fetch();
        if ($row === false || ($row['status'] ?? '') !== 'active') {
            return;
        }

        $tags = json_decode((string) ($row['tags'] ?? '[]'), true);
        $tags = is_array($tags) ? array_map(static fn ($t) => strtolower(trim((string) $t)), $tags) : [];

        $subs = $pdo->prepare(
            'SELECT user_id, club_tag FROM stock_alert_subscriptions WHERE product_id = ?'
        );
        $subs->execute([$productId]);

        $name = (string) $row['name'];
        $slug = (string) $row['slug'];
        $title = $name . ' is back in stock';
        $body = 'Good news — ' . $name . ' is available again. Order before it sells out.';
        $link = '/product/' . $slug;

        foreach ($subs->fetchAll() as $sub) {
            $clubTag = $sub['club_tag'] !== null ? strtolower(trim((string) $sub['club_tag'])) : '';
            if ($clubTag !== '' && !in_array($clubTag, $tags, true)) {
                continue;
            }

            NotificationService::notifyUser(
                $pdo,
                (int) $sub['user_id'],
                $title,
                $body,
                $link,
                'restock'
            );
        }
    }

    private static function normalizeTag(?string $clubTag): ?string
    {
        if ($clubTag === null) {
            return null;
        }
        $tag = trim($clubTag);
        if ($tag === '') {
            return null;
        }

        return mb_substr($tag, 0, 80);
    }
}
