<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** POS module access checks. */
final class PosGate
{
    public static function isEnabled(PDO $pdo): bool
    {
        return PosSettingsService::load($pdo)['pos_module_enabled'];
    }

    /** @param array<string,mixed> $user */
    public static function assertEnabled(PDO $pdo, array $user): void
    {
        if (!self::isEnabled($pdo)) {
            Response::error('Point of sale is not enabled.', 403, ['code' => 'pos_disabled']);
        }
        if (!in_array($user['role'] ?? '', ['admin', 'super_admin'], true)) {
            Response::error('POS access requires a staff account.', 403);
        }
    }

    /** @param array<string,mixed> $user */
    public static function canUsePos(array $user): bool
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return true;
        }
        $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return !empty($perms['use_pos']);
    }

    /** @param array<string,mixed> $user */
    public static function canManageShifts(array $user): bool
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return true;
        }
        $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return !empty($perms['manage_pos_shifts']);
    }

    /** @param array<string,mixed> $user */
    public static function canManageConfig(array $user): bool
    {
        if (($user['role'] ?? '') === 'super_admin') {
            return true;
        }
        $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];

        return !empty($perms['manage_pos_config']) || !empty($perms['edit_company_settings']);
    }

    /** @param array<string,mixed> $user */
    public static function assertUsePos(array $user): void
    {
        if (!self::canUsePos($user)) {
            Response::error('You do not have permission to use the register.', 403);
        }
    }

    /** @param array<string,mixed> $user */
    public static function assertManageShifts(array $user): void
    {
        if (!self::canManageShifts($user)) {
            Response::error('Supervisor permission required.', 403);
        }
    }

    /** @param array<string,mixed> $user */
    public static function assertManageConfig(array $user): void
    {
        if (!self::canManageConfig($user)) {
            Response::error('You cannot manage POS settings.', 403);
        }
    }
}
