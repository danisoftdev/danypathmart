<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;
use OTPHP\TOTP;

final class TOTPService
{
    public const ISSUER = 'DanyPathMart';
    public const PERIOD = 30;
    public const BACKUP_CODE_COUNT = 8;

    public static function generateSecret(): string
    {
        return TOTP::generate()->getSecret();
    }

    public static function provisioningUri(string $secret, string $email): string
    {
        $totp = TOTP::createFromSecret($secret);
        $totp->setLabel($email);
        $totp->setIssuer(self::ISSUER);
        return $totp->getProvisioningUri();
    }

    /**
     * Verify a code allowing +/- 1 time-step (90s total) for clock drift.
     */
    public static function verify(string $secret, string $code): bool
    {
        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        $totp = TOTP::createFromSecret($secret);
        $now = time();
        foreach ([$now - self::PERIOD, $now, $now + self::PERIOD] as $timestamp) {
            if ($totp->verify($code, $timestamp, null)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return array{plain:string[],hashed:string[]}
     */
    public static function generateBackupCodes(): array
    {
        $plain = [];
        $hashed = [];
        for ($i = 0; $i < self::BACKUP_CODE_COUNT; $i++) {
            $code = strtoupper(bin2hex(random_bytes(5)));
            $plain[] = $code;
            $hashed[] = hash('sha256', $code);
        }
        return ['plain' => $plain, 'hashed' => $hashed];
    }

    /**
     * Verify and consume (single-use) a backup code for the user.
     */
    public static function verifyBackupCode(int $userId, string $code): bool
    {
        $code = strtoupper(trim($code));
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT totp_backup_codes FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $raw = $stmt->fetchColumn();
        if ($raw === false || $raw === null) {
            return false;
        }

        $codes = json_decode((string) $raw, true);
        if (!is_array($codes)) {
            return false;
        }

        $target = hash('sha256', $code);
        $matchIndex = null;
        foreach ($codes as $index => $stored) {
            if (is_string($stored) && hash_equals($stored, $target)) {
                $matchIndex = $index;
                break;
            }
        }
        if ($matchIndex === null) {
            return false;
        }

        array_splice($codes, $matchIndex, 1);
        $pdo->prepare('UPDATE users SET totp_backup_codes = ? WHERE id = ?')
            ->execute([json_encode(array_values($codes)), $userId]);

        return true;
    }
}
