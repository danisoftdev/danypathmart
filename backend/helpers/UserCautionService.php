<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

/** Admin cautions for any user (buyers, shop owners, staff). */
final class UserCautionService
{
    public const LEVELS = ['notice', 'caution', 'final_warning', 'restriction', 'suspension'];

    /** @return list<array<string,mixed>> */
    public static function pendingForUser(PDO $pdo, int $userId): array
    {
        $stmt = $pdo->prepare(
            "SELECT * FROM user_cautions
             WHERE user_id = ? AND acknowledged_at IS NULL
               AND level IN ('caution', 'final_warning', 'restriction', 'suspension')
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY id ASC"
        );
        $stmt->execute([$userId]);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function userIsRestricted(PDO $pdo, int $userId): bool
    {
        $stmt = $pdo->prepare(
            "SELECT 1 FROM user_cautions
             WHERE user_id = ? AND level IN ('restriction', 'suspension')
               AND (expires_at IS NULL OR expires_at > NOW())
             LIMIT 1"
        );
        $stmt->execute([$userId]);

        return $stmt->fetchColumn() !== false;
    }

    /** @return array<string,mixed> */
    public static function issue(
        PDO $pdo,
        int $userId,
        int $issuedBy,
        string $level,
        string $message,
        ?string $internalNote = null,
        ?int $reportId = null,
        ?string $expiresAt = null
    ): array {
        if (!in_array($level, self::LEVELS, true)) {
            throw new RuntimeException('Invalid caution level.');
        }
        $message = trim($message);
        if ($message === '') {
            throw new RuntimeException('Message is required.');
        }

        $pdo->prepare(
            'INSERT INTO user_cautions (user_id, issued_by, level, message, internal_note, report_id, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $userId,
            $issuedBy,
            $level,
            $message,
            $internalNote !== null && trim($internalNote) !== '' ? trim($internalNote) : null,
            $reportId,
            $expiresAt,
        ]);

        $id = (int) $pdo->lastInsertId();

        if (in_array($level, ['caution', 'final_warning', 'restriction', 'suspension'], true)) {
            NotificationService::notifyUser(
                $pdo,
                $userId,
                'Account notice from DanyPathMart',
                $message,
                '/dashboard',
                'account_caution'
            );
        }

        if ($level === 'suspension') {
            $pdo->prepare("UPDATE users SET status = 'disabled' WHERE id = ?")->execute([$userId]);
            $shopId = ShopService::userShopId($pdo, $userId);
            if ($shopId !== null) {
                $pdo->prepare("UPDATE shops SET status = 'suspended', is_published = 0 WHERE id = ?")->execute([$shopId]);
            }
        }

        return self::findById($pdo, $id) ?? [];
    }

    public static function acknowledge(PDO $pdo, int $userId, int $cautionId): void
    {
        $pdo->prepare(
            'UPDATE user_cautions SET acknowledged_at = NOW()
             WHERE id = ? AND user_id = ? AND acknowledged_at IS NULL'
        )->execute([$cautionId, $userId]);
    }

    /** @return list<array<string,mixed>> */
    public static function historyForUser(PDO $pdo, int $userId, int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $stmt = $pdo->prepare(
            'SELECT c.*, u.name AS issued_by_name FROM user_cautions c
             LEFT JOIN users u ON u.id = c.issued_by
             WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT ' . $limit
        );
        $stmt->execute([$userId]);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM user_cautions WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'user_id'         => (int) $row['user_id'],
            'issued_by'       => $row['issued_by'] !== null ? (int) $row['issued_by'] : null,
            'issued_by_name'  => $row['issued_by_name'] ?? null,
            'level'           => (string) $row['level'],
            'message'         => (string) $row['message'],
            'internal_note'   => $row['internal_note'],
            'report_id'       => $row['report_id'] !== null ? (int) $row['report_id'] : null,
            'expires_at'      => $row['expires_at'],
            'acknowledged_at' => $row['acknowledged_at'],
            'created_at'      => $row['created_at'],
        ];
    }
}
