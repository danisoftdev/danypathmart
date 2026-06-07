<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Default permission sets per job role type (position). */
final class PositionPermissionService
{
    /**
     * @return list<array{slug:string,label:string,is_driver:bool,permissions:array<string,bool>}>
     */
    public static function listWithTemplates(PDO $pdo): array
    {
        $roles = CareerService::listRoleTypes($pdo);
        $out = [];

        foreach ($roles as $role) {
            $slug = (string) $role['slug'];
            $out[] = [
                'slug'        => $slug,
                'label'       => (string) $role['label'],
                'is_driver'   => (bool) $role['is_driver'],
                'permissions' => self::getTemplate($pdo, $slug),
            ];
        }

        return $out;
    }

    /** @return array<string, bool> */
    public static function getTemplate(PDO $pdo, string $roleSlug): array
    {
        try {
            $stmt = $pdo->prepare('SELECT permissions FROM position_permission_templates WHERE role_slug = ?');
            $stmt->execute([$roleSlug]);
            $json = $stmt->fetchColumn();
            if ($json !== false) {
                $decoded = json_decode((string) $json, true);
                if (is_array($decoded)) {
                    return StaffPermission::sanitize($decoded);
                }
            }
        } catch (\Throwable) {
            /* table may not exist yet */
        }

        return StaffPermission::defaults(false);
    }

    /**
     * @param array<string, mixed> $permissions
     * @return array<string, bool>
     */
    public static function saveTemplate(PDO $pdo, string $roleSlug, array $permissions): array
    {
        $clean = StaffPermission::sanitize($permissions);

        $check = $pdo->prepare('SELECT slug FROM job_role_types WHERE slug = ?');
        $check->execute([$roleSlug]);
        if ($check->fetch() === false) {
            throw new \InvalidArgumentException('Unknown position type.');
        }

        $pdo->prepare(
            'INSERT INTO position_permission_templates (role_slug, permissions)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE permissions = VALUES(permissions)'
        )->execute([$roleSlug, json_encode($clean)]);

        return $clean;
    }
}
