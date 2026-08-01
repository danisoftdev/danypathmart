<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Config\Database;
use App\Helpers\Jwt;
use App\Helpers\Response;
use Firebase\JWT\ExpiredException;
use Throwable;

final class AuthMiddleware
{
    /** @var array<string,mixed>|null */
    private static ?array $user = null;

    /**
     * Require a valid Bearer JWT. Halts the request with 401/403 on failure.
     * On success, loads the user row, caches it, and returns it.
     *
     * @return array<string,mixed>
     */
    public static function authenticate(): array
    {
        $token = self::bearerToken();
        if ($token === null) {
            Response::error('Missing or invalid Authorization header', 401);
        }

        try {
            $claims = Jwt::decode($token);
        } catch (ExpiredException $e) {
            Response::error('Access token expired', 401, ['code' => 'token_expired']);
        } catch (Throwable $e) {
            Response::error('Invalid access token', 401);
        }

        $userId = (int) ($claims['sub'] ?? 0);
        if ($userId <= 0) {
            Response::error('Invalid token subject', 401);
        }

        $pdo = Database::pdo();
        try {
            $stmt = $pdo->prepare(
                'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled,
                        must_change_password, profile_photo, assigned_pickup_station_id
                 FROM users WHERE id = ?'
            );
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
        } catch (\Throwable) {
            $stmt = $pdo->prepare(
                'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo,
                        assigned_pickup_station_id
                 FROM users WHERE id = ?'
            );
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (is_array($user)) {
                $user['must_change_password'] = 0;
            }
        }

        if ($user === false) {
            Response::error('User not found', 401);
        }
        if ($user['status'] === 'disabled') {
            Response::error('Account disabled', 403);
        }
        if ($user['status'] === 'pending_deletion') {
            Response::error('Account is scheduled for deletion. Sign in again to restore it.', 403, [
                'code' => 'pending_deletion',
            ]);
        }

        self::$user = $user;
        return $user;
    }

    /**
     * Require an authenticated admin/staff account. Halts with 403 otherwise.
     *
     * @return array<string,mixed>
     */
    public static function requireAdmin(): array
    {
        $user = self::authenticate();
        if (!in_array($user['role'] ?? '', ['super_admin', 'staff'], true)) {
            Response::error('Administrator access required.', 403, ['code' => 'forbidden']);
        }
        return $user;
    }

    /**
     * Require an authenticated super_admin. Halts with 403 otherwise.
     *
     * @return array<string,mixed>
     */
    /**
     * Require an authenticated driver account.
     *
     * @return array<string,mixed>
     */
    public static function requireStationStaff(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? '') !== 'station_staff') {
            Response::error('Station staff access required.', 403, ['code' => 'forbidden']);
        }
        $flags = \App\Helpers\PlatformFeatures::load(\App\Config\Database::pdo());
        if (!$flags['station_repack_module_enabled']) {
            Response::error('Station repack module is not enabled.', 403);
        }
        if (empty($user['assigned_pickup_station_id'])) {
            Response::error('Your account is not assigned to a pickup station.', 403);
        }

        return $user;
    }

    public static function requireDriver(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? '') !== 'driver') {
            Response::error('Driver access required.', 403, ['code' => 'forbidden']);
        }
        if (!\App\Helpers\PlatformFeatures::load(\App\Config\Database::pdo())['driver_module_enabled']) {
            Response::error('Driver logistics module is not enabled.', 403);
        }
        return $user;
    }

    public static function requireSuperAdmin(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? '') !== 'super_admin') {
            Response::error('Super administrator access required.', 403, ['code' => 'forbidden']);
        }
        return $user;
    }

    /** @return array{user:array<string,mixed>,promoter:array<string,mixed>,promoter_id:int} */
    public static function requirePromoter(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? '') !== 'promoter') {
            Response::error('Promoter access required.', 403, ['code' => 'forbidden']);
        }
        $promoter = \App\Helpers\PromoterService::findByUserId(\App\Config\Database::pdo(), (int) $user['id']);
        if ($promoter === null || ($promoter['status'] ?? '') !== 'active') {
            Response::error('Your promoter account is not active.', 403);
        }

        return ['user' => $user, 'promoter' => $promoter, 'promoter_id' => (int) $promoter['id']];
    }

    /**
     * Require super_admin or at least one of the given RBAC permissions.
     *
     * @param list<string> $permissions
     * @return array<string,mixed>
     */
    public static function requireAnyPermission(array $permissions): array
    {
        $user = self::requireAdmin();
        if (($user['role'] ?? '') === 'super_admin') {
            return $user;
        }
        if (!\App\Helpers\StaffPermission::userHasAny((int) $user['id'], (string) $user['role'], $permissions)) {
            Response::error('You do not have permission to perform this action.', 403, ['code' => 'forbidden']);
        }
        return $user;
    }

    /**
     * @return array<string,mixed>
     */
    public static function getUser(): ?array
    {
        return self::$user;
    }

    /**
     * Resolve the user from a Bearer token if present, without halting the
     * request. Returns null for guests or invalid/expired tokens.
     *
     * @return array<string,mixed>|null
     */
    public static function optional(): ?array
    {
        $token = self::bearerToken();
        if ($token === null) {
            return null;
        }

        try {
            $claims = Jwt::decode($token);
        } catch (Throwable $e) {
            return null;
        }

        $userId = (int) ($claims['sub'] ?? 0);
        if ($userId <= 0) {
            return null;
        }

        $pdo = Database::pdo();
        try {
            $stmt = $pdo->prepare(
                'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled,
                        must_change_password, profile_photo, assigned_pickup_station_id
                 FROM users WHERE id = ?'
            );
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
        } catch (\Throwable) {
            $stmt = $pdo->prepare(
                'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo,
                        assigned_pickup_station_id
                 FROM users WHERE id = ?'
            );
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (is_array($user)) {
                $user['must_change_password'] = 0;
            }
        }

        if ($user === false || $user['status'] === 'disabled' || $user['status'] === 'pending_deletion') {
            return null;
        }

        self::$user = $user;
        return $user;
    }

    private static function bearerToken(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

        if ($auth === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }

        if (preg_match('/Bearer\s+(\S+)/i', (string) $auth, $m) === 1) {
            return trim($m[1]);
        }
        return null;
    }
}
