<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;
use App\Config\Env;

final class AuthTokens
{
    public const REFRESH_COOKIE = 'dpm_refresh';

    /**
     * Issue an access token + refresh session for a user row and set the cookie.
     *
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    public static function issueFor(array $user): array
    {
        $access = Jwt::issueAccess([
            'sub'      => (int) $user['id'],
            'role'     => $user['role'],
            'email'    => $user['email'],
            'username' => $user['username'],
        ]);

        $refresh = self::createRefreshSession((int) $user['id']);
        self::setRefreshCookie($refresh);

        return [
            'access_token' => $access,
            'token_type'   => 'Bearer',
            'expires_in'   => Env::int('JWT_EXPIRY', 900),
            'user'         => self::publicUser($user),
        ];
    }

    public static function createRefreshSession(int $userId): string
    {
        $pdo = Database::pdo();
        $refresh = bin2hex(random_bytes(32));
        $ttl = Env::int('JWT_REFRESH_EXPIRY', 604800);
        $expires = date('Y-m-d H:i:s', time() + $ttl);
        $device = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'), 0, 250);
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;

        $stmt = $pdo->prepare(
            'INSERT INTO user_sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, hash('sha256', $refresh), $device, $ip, $expires]);

        return $refresh;
    }

    public static function setRefreshCookie(string $refresh): void
    {
        $ttl = Env::int('JWT_REFRESH_EXPIRY', 604800);
        $secure = Env::isProduction();
        setcookie(self::REFRESH_COOKIE, $refresh, [
            'expires'  => time() + $ttl,
            'path'     => '/',
            'httponly' => true,
            'secure'   => $secure,
            'samesite' => $secure ? 'None' : 'Lax',
        ]);
    }

    public static function clearRefreshCookie(): void
    {
        setcookie(self::REFRESH_COOKIE, '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'httponly' => true,
            'secure'   => Env::isProduction(),
            'samesite' => Env::isProduction() ? 'None' : 'Lax',
        ]);
    }

    /**
     * @param array<string,mixed> $u
     * @return array<string,mixed>
     */
    public static function publicUser(array $u): array
    {
        $pdo = Database::pdo();
        $shopId = null;
        try {
            $shopId = ShopService::userShopId($pdo, (int) $u['id']);
        } catch (\Throwable) {
            $shopId = null;
        }

        $mustChange = 0;
        if (array_key_exists('must_change_password', $u)) {
            $mustChange = (int) $u['must_change_password'];
        } else {
            try {
                $flag = $pdo->prepare('SELECT must_change_password FROM users WHERE id = ?');
                $flag->execute([(int) $u['id']]);
                $mustChange = (int) ($flag->fetchColumn() ?: 0);
            } catch (\Throwable) {
                $mustChange = 0;
            }
        }

        return [
            'id'                 => (int) $u['id'],
            'name'               => $u['name'],
            'username'           => $u['username'],
            'email'              => $u['email'],
            'role'               => $u['role'],
            'status'             => $u['status'],
            'preferred_currency' => $u['preferred_currency'] ?? 'GHS',
            'phone'              => $u['phone'] ?? null,
            'profile_photo'      => $u['profile_photo'] ?? null,
            'totp_enabled'               => (int) ($u['totp_enabled'] ?? 0),
            'must_change_password'       => $mustChange === 1,
            'needs_email_verification'   => ($u['status'] ?? '') === 'unverified',
            'assigned_pickup_station_id' => isset($u['assigned_pickup_station_id'])
                ? ($u['assigned_pickup_station_id'] !== null ? (int) $u['assigned_pickup_station_id'] : null)
                : null,
            'permissions'                => StaffPermission::effective((int) $u['id'], (string) $u['role']),
            'staff_id'                   => EmployeeService::isWorkforceRole((string) ($u['role'] ?? ''))
                ? EmployeeService::staffIdForUserId($pdo, (int) $u['id'])
                : null,
            'has_shop'                   => $shopId !== null && $shopId > 0,
            'shop_id'                    => $shopId !== null && $shopId > 0 ? $shopId : null,
        ];
    }
}
