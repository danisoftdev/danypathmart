<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;

/**
 * Canonical RBAC permission keys and helpers for resolving a user's effective
 * permission set. super_admin implicitly holds every permission.
 */
final class StaffPermission
{
    /** The 15 permission keys, in display order. */
    public const KEYS = [
        'view_orders',
        'edit_orders',
        'view_products',
        'add_edit_products',
        'delete_products',
        'manage_categories',
        'view_users',
        'edit_users',
        'manage_staff',
        'view_company_settings',
        'edit_company_settings',
        'manage_shipping',
        'view_reports',
        'view_image_alerts',
        'manage_image_alerts',
    ];

    /**
     * @return array<string,bool>
     */
    public static function defaults(bool $value = false): array
    {
        return array_fill_keys(self::KEYS, $value);
    }

    /**
     * Raw permissions JSON string stored for a user, or null when none.
     */
    public static function getForUser(int $userId): ?string
    {
        $stmt = Database::pdo()->prepare('SELECT permissions FROM staff_permissions WHERE user_id = ?');
        $stmt->execute([$userId]);
        $value = $stmt->fetchColumn();
        return $value === false ? null : (string) $value;
    }

    /**
     * Effective permission map for a user. super_admin => all true,
     * staff => stored set normalised to all 15 keys, others => all false.
     *
     * @return array<string,bool>
     */
    public static function effective(int $userId, string $role): array
    {
        if ($role === 'super_admin') {
            return self::defaults(true);
        }

        $json = self::getForUser($userId);
        $stored = $json !== null ? json_decode($json, true) : [];
        if (!is_array($stored)) {
            $stored = [];
        }

        $out = self::defaults(false);
        foreach (self::KEYS as $key) {
            $out[$key] = !empty($stored[$key]);
        }
        return $out;
    }

    /**
     * Normalise arbitrary input into a clean {key:bool} map of known keys only.
     *
     * @param array<string,mixed> $input
     * @return array<string,bool>
     */
    public static function sanitize(array $input): array
    {
        $out = self::defaults(false);
        foreach (self::KEYS as $key) {
            $out[$key] = !empty($input[$key]);
        }
        return $out;
    }
}
