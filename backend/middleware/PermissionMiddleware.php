<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Helpers\Response;
use App\Helpers\StaffPermission;

final class PermissionMiddleware
{
    /**
     * Require a specific RBAC permission. super_admin bypasses all checks.
     * Halts with 403 when the authenticated user lacks the permission.
     */
    public static function require(string $permission): void
    {
        $user = AuthMiddleware::getUser() ?? AuthMiddleware::authenticate();

        if (($user['role'] ?? '') === 'super_admin') {
            return;
        }

        $perms = StaffPermission::effective((int) $user['id'], (string) $user['role']);
        if (empty($perms[$permission])) {
            Response::error('You do not have permission to perform this action.', 403, [
                'code'       => 'forbidden',
                'permission' => $permission,
            ]);
        }
    }

    /** @param list<string> $permissions */
    public static function requireAny(array $permissions): void
    {
        $user = AuthMiddleware::getUser() ?? AuthMiddleware::authenticate();

        if (($user['role'] ?? '') === 'super_admin') {
            return;
        }

        if (!StaffPermission::userHasAny((int) $user['id'], (string) $user['role'], $permissions)) {
            Response::error('You do not have permission to perform this action.', 403, [
                'code' => 'forbidden',
            ]);
        }
    }
}
