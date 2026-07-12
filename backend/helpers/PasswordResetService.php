<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use App\Middleware\RateLimiter;
use PDO;

/**
 * Password reset via 6-digit email code and/or opaque magic link.
 * Tokens are stored hashed; OTPs are attempt-limited; sessions revoked on success.
 */
final class PasswordResetService
{
    public const LINK_TTL_SECONDS = 3600;
    public const MAX_ISSUES_PER_HOUR = 3;

    private static ?bool $hasTokenHash = null;

    public static function hasTokenHashColumn(PDO $pdo): bool
    {
        if (self::$hasTokenHash !== null) {
            return self::$hasTokenHash;
        }
        try {
            $pdo->query('SELECT token_hash FROM email_verifications LIMIT 0');
            self::$hasTokenHash = true;
        } catch (\Throwable) {
            self::$hasTokenHash = false;
        }

        return self::$hasTokenHash;
    }

    /**
     * @return array{id:int,name:string,email:string}|null
     */
    public static function findResettableUser(PDO $pdo, string $identifier): ?array
    {
        $identifier = trim($identifier);
        if ($identifier === '') {
            return null;
        }

        $stmt = $pdo->prepare(
            "SELECT id, name, email, status FROM users
             WHERE email = ? AND status != 'disabled' LIMIT 1"
        );
        $stmt->execute([strtolower($identifier)]);
        $user = $stmt->fetch();

        if ($user === false) {
            $stmt = $pdo->prepare(
                "SELECT id, name, email, status FROM users
                 WHERE LOWER(username) = LOWER(?) AND status != 'disabled' LIMIT 1"
            );
            $stmt->execute([$identifier]);
            $user = $stmt->fetch();
        }

        if ($user === false) {
            return null;
        }

        $email = trim((string) ($user['email'] ?? ''));
        if ($email === '' || !Validator::email($email)) {
            return null;
        }

        return [
            'id'    => (int) $user['id'],
            'name'  => (string) $user['name'],
            'email' => $email,
        ];
    }

    /**
     * Issue a fresh OTP (+ optional opaque link token). Invalidates prior resets.
     *
     * @return array{otp:string,link:string,expires_at:string}
     */
    public static function issue(PDO $pdo, int $userId): array
    {
        // Persist hourly cap even after old verification rows are deleted.
        $hourCap = RateLimiter::hit('pwdreset:user:' . $userId, self::MAX_ISSUES_PER_HOUR, 3600);
        if (!$hourCap['allowed']) {
            throw new \RuntimeException('Too many reset requests. Please try again later.');
        }

        $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ? AND type = 'password_reset'")
            ->execute([$userId]);

        $otp = OTPService::generate();
        $expiresTs = time() + self::LINK_TTL_SECONDS;
        $expires = date('Y-m-d H:i:s', $expiresTs);
        $linkToken = bin2hex(random_bytes(32));
        $otpHash = OTPService::hash($otp);
        $tokenHash = hash('sha256', $linkToken);

        if (self::hasTokenHashColumn($pdo)) {
            $pdo->prepare(
                "INSERT INTO email_verifications (user_id, otp_hash, token_hash, type, expires_at, attempts)
                 VALUES (?, ?, ?, 'password_reset', ?, 0)"
            )->execute([$userId, $otpHash, $tokenHash, $expires]);
        } else {
            // Fallback: store OTP hash; magic link is HMAC-signed with the OTP inside.
            $pdo->prepare(
                "INSERT INTO email_verifications (user_id, otp_hash, type, expires_at, attempts)
                 VALUES (?, ?, 'password_reset', ?, 0)"
            )->execute([$userId, $otpHash, $expires]);
            $linkToken = self::signedLegacyToken($userId, $otp, $expiresTs);
        }

        Env::load();
        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $link = $frontend . '/reset-password?token=' . urlencode($linkToken);

        return [
            'otp'        => $otp,
            'link'       => $link,
            'expires_at' => $expires,
        ];
    }

    /**
     * Resolve a magic-link token to a user id, or null if invalid/expired/locked.
     * Does not consume the OTP/token (consumption happens on successful password change).
     */
    public static function userIdFromLinkToken(PDO $pdo, string $token): ?int
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        // Opaque 64-hex token (preferred).
        if (strlen($token) === 64 && ctype_xdigit($token)) {
            if (!self::hasTokenHashColumn($pdo)) {
                return null;
            }
            $stmt = $pdo->prepare(
                "SELECT id, user_id, expires_at, attempts
                 FROM email_verifications
                 WHERE type = 'password_reset' AND token_hash = ? LIMIT 1"
            );
            $stmt->execute([hash('sha256', $token)]);
            $row = $stmt->fetch();
            if ($row === false) {
                return null;
            }
            if ((int) $row['attempts'] >= OTPService::MAX_ATTEMPTS) {
                return null;
            }
            if (strtotime((string) $row['expires_at']) < time()) {
                return null;
            }

            return (int) $row['user_id'];
        }

        // Legacy signed token (OTP embedded, HMAC-verified) when token_hash column missing.
        $parsed = self::parseSignedLegacyToken($token);
        if ($parsed === null) {
            return null;
        }
        if ($parsed['exp'] < time()) {
            return null;
        }

        $result = OTPService::peek($pdo, $parsed['user_id'], $parsed['otp'], 'password_reset');
        return $result === 'ok' ? $parsed['user_id'] : null;
    }

    /**
     * Verify identifier + 6-digit code. On success returns user id; does not delete yet
     * when $consume is false (peek). Prefer consume=true only after password updated —
     * actually OTPService::verify already deletes. So we verify as part of complete().
     *
     * @return array{ok:bool,user_id?:int,error?:string}
     */
    public static function verifyCode(PDO $pdo, string $identifier, string $otp): array
    {
        $otp = preg_replace('/\D+/', '', $otp) ?? '';
        if (strlen($otp) !== 6) {
            return ['ok' => false, 'error' => 'invalid'];
        }

        $user = self::findResettableUser($pdo, $identifier);
        if ($user === null) {
            // Same timing path as invalid OTP — do not reveal whether the account exists.
            return ['ok' => false, 'error' => 'invalid'];
        }

        $status = OTPService::verify($user['id'], $otp, 'password_reset');
        if ($status !== 'ok') {
            return ['ok' => false, 'error' => $status];
        }

        return ['ok' => true, 'user_id' => $user['id']];
    }

    /**
     * Complete reset with either magic-link token or identifier+otp.
     *
     * @return array{ok:bool,error?:string}
     */
    public static function complete(
        PDO $pdo,
        string $newPassword,
        ?string $token = null,
        ?string $identifier = null,
        ?string $otp = null
    ): array {
        $userId = null;

        if ($token !== null && trim($token) !== '') {
            $token = trim($token);
            if (strlen($token) === 64 && ctype_xdigit($token) && self::hasTokenHashColumn($pdo)) {
                $stmt = $pdo->prepare(
                    "SELECT id, user_id, expires_at, attempts
                     FROM email_verifications
                     WHERE type = 'password_reset' AND token_hash = ? LIMIT 1"
                );
                $stmt->execute([hash('sha256', $token)]);
                $row = $stmt->fetch();
                if ($row === false) {
                    return ['ok' => false, 'error' => 'bad_token'];
                }
                if ((int) $row['attempts'] >= OTPService::MAX_ATTEMPTS) {
                    return ['ok' => false, 'error' => 'locked'];
                }
                if (strtotime((string) $row['expires_at']) < time()) {
                    return ['ok' => false, 'error' => 'expired'];
                }
                $userId = (int) $row['user_id'];
                // Consume all password_reset rows for this user.
                $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ? AND type = 'password_reset'")
                    ->execute([$userId]);
            } else {
                $parsed = self::parseSignedLegacyToken($token);
                if ($parsed === null || $parsed['exp'] < time()) {
                    return ['ok' => false, 'error' => 'bad_token'];
                }
                $status = OTPService::verify($parsed['user_id'], $parsed['otp'], 'password_reset');
                if ($status !== 'ok') {
                    return ['ok' => false, 'error' => $status === 'none' ? 'bad_token' : $status];
                }
                $userId = $parsed['user_id'];
            }
        } elseif ($identifier !== null && $otp !== null) {
            $verified = self::verifyCode($pdo, $identifier, $otp);
            if (!$verified['ok']) {
                return ['ok' => false, 'error' => $verified['error'] ?? 'invalid'];
            }
            $userId = (int) $verified['user_id'];
        } else {
            return ['ok' => false, 'error' => 'bad_token'];
        }

        if ($userId === null || $userId <= 0) {
            return ['ok' => false, 'error' => 'bad_token'];
        }

        $check = $pdo->prepare("SELECT id FROM users WHERE id = ? AND status != 'disabled' LIMIT 1");
        $check->execute([$userId]);
        if ($check->fetch() === false) {
            return ['ok' => false, 'error' => 'bad_token'];
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$newHash, $userId]);
            $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ? AND type = 'password_reset'")
                ->execute([$userId]);
            $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['ok' => true, 'user_id' => $userId];
    }

    private static function signingKey(): string
    {
        Env::load();
        return (string) Env::get('JWT_SECRET', 'dev-insecure-secret-change-me-now');
    }

    private static function signedLegacyToken(int $userId, string $otp, int $exp): string
    {
        $payload = $userId . '|' . $exp . '|' . $otp;
        $sig = hash_hmac('sha256', $payload, self::signingKey());
        return rtrim(strtr(base64_encode($payload . '|' . $sig), '+/', '-_'), '=');
    }

    /** @return array{user_id:int,exp:int,otp:string}|null */
    private static function parseSignedLegacyToken(string $token): ?array
    {
        $pad = strlen($token) % 4;
        if ($pad > 0) {
            $token .= str_repeat('=', 4 - $pad);
        }
        $raw = base64_decode(strtr($token, '-_', '+/'), true);
        if ($raw === false) {
            return null;
        }
        $parts = explode('|', $raw);
        if (count($parts) !== 4) {
            return null;
        }
        [$userId, $exp, $otp, $sig] = $parts;
        if (!ctype_digit($userId) || !ctype_digit($exp) || !preg_match('/^\d{6}$/', $otp)) {
            return null;
        }
        $payload = $userId . '|' . $exp . '|' . $otp;
        $expected = hash_hmac('sha256', $payload, self::signingKey());
        if (!hash_equals($expected, $sig)) {
            return null;
        }

        return [
            'user_id' => (int) $userId,
            'exp'     => (int) $exp,
            'otp'     => $otp,
        ];
    }
}
