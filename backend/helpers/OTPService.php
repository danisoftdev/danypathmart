<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;
use DateTimeImmutable;
use PDO;

final class OTPService
{
    public const TTL_MINUTES = 30;
    public const MAX_ATTEMPTS = 5;
    public const RESEND_LIMIT_PER_HOUR = 3;

    public static function generate(): string
    {
        return str_pad((string) random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function hash(string $otp): string
    {
        return hash('sha256', $otp);
    }

    /**
     * Generate a fresh OTP for the user, persist its hash, return the plain code.
     * Prior codes of the same type are invalidated.
     */
    public static function issue(int $userId, string $type = 'registration'): string
    {
        $pdo = Database::pdo();
        $pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')
            ->execute([$userId, $type]);

        $otp = self::generate();
        $expires = (new DateTimeImmutable('+' . self::TTL_MINUTES . ' minutes'))->format('Y-m-d H:i:s');

        $stmt = $pdo->prepare(
            'INSERT INTO email_verifications (user_id, otp_hash, type, expires_at, attempts)
             VALUES (?, ?, ?, ?, 0)'
        );
        $stmt->execute([$userId, self::hash($otp), $type, $expires]);

        return $otp;
    }

    /**
     * Count how many codes of this type were issued in the trailing hour.
     */
    public static function issuedLastHour(int $userId, string $type = 'registration'): int
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM email_verifications
             WHERE user_id = ? AND type = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)'
        );
        $stmt->execute([$userId, $type]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Verify a submitted OTP against the most recent code for the user/type.
     *
     * @return string one of: ok | invalid | expired | locked | none
     */
    public static function verify(int $userId, string $otp, string $type = 'registration'): string
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT id, otp_hash, expires_at, attempts FROM email_verifications
             WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([$userId, $type]);
        $row = $stmt->fetch();

        if ($row === false) {
            return 'none';
        }
        if ((int) $row['attempts'] >= self::MAX_ATTEMPTS) {
            return 'locked';
        }
        if (strtotime((string) $row['expires_at']) < time()) {
            return 'expired';
        }

        if (!hash_equals((string) $row['otp_hash'], self::hash($otp))) {
            $pdo->prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
                ->execute([$row['id']]);
            return ((int) $row['attempts'] + 1) >= self::MAX_ATTEMPTS ? 'locked' : 'invalid';
        }

        // Success: clear every outstanding code of this type for the user.
        $pdo->prepare('DELETE FROM email_verifications WHERE user_id = ? AND type = ?')
            ->execute([$userId, $type]);

        return 'ok';
    }

    /**
     * Check OTP without consuming it or bumping attempts on success.
     * Failed checks still increment attempts (same as verify).
     *
     * @return string one of: ok | invalid | expired | locked | none
     */
    public static function peek(PDO $pdo, int $userId, string $otp, string $type = 'registration'): string
    {
        $stmt = $pdo->prepare(
            'SELECT id, otp_hash, expires_at, attempts FROM email_verifications
             WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([$userId, $type]);
        $row = $stmt->fetch();

        if ($row === false) {
            return 'none';
        }
        if ((int) $row['attempts'] >= self::MAX_ATTEMPTS) {
            return 'locked';
        }
        if (strtotime((string) $row['expires_at']) < time()) {
            return 'expired';
        }

        if (!hash_equals((string) $row['otp_hash'], self::hash($otp))) {
            $pdo->prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
                ->execute([$row['id']]);
            return ((int) $row['attempts'] + 1) >= self::MAX_ATTEMPTS ? 'locked' : 'invalid';
        }

        return 'ok';
    }
}
