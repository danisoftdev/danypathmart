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

        $stmt = Database::pdo()->prepare(
            'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
             FROM users WHERE id = ?'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if ($user === false) {
            Response::error('User not found', 401);
        }
        if ($user['status'] === 'disabled') {
            Response::error('Account disabled', 403);
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
    public static function requireSuperAdmin(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? '') !== 'super_admin') {
            Response::error('Super administrator access required.', 403, ['code' => 'forbidden']);
        }
        return $user;
    }

    /**
     * @return array<string,mixed>|null
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

        $stmt = Database::pdo()->prepare(
            'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
             FROM users WHERE id = ?'
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if ($user === false || $user['status'] === 'disabled') {
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
