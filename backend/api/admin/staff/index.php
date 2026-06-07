<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StaffPermission;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAnyPermission(['manage_staff']);
$pdo = Database::pdo();

$stmt = $pdo->query(
    "SELECT u.id, u.name, u.username, u.email, u.role, u.status, u.totp_enabled, u.created_at,
            sp.role_name, sp.permissions, e.staff_id
     FROM users u
     LEFT JOIN staff_permissions sp ON sp.user_id = u.id
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.role = 'staff'
     ORDER BY u.created_at DESC"
);

$rows = array_map(static function (array $r): array {
    $perms = $r['permissions'] !== null ? json_decode((string) $r['permissions'], true) : [];
    $normalised = StaffPermission::defaults(false);
    if (is_array($perms)) {
        foreach (StaffPermission::KEYS as $k) {
            $normalised[$k] = !empty($perms[$k]);
        }
    }
    return [
        'id'           => (int) $r['id'],
        'name'         => $r['name'],
        'username'     => $r['username'],
        'email'        => $r['email'],
        'role'         => $r['role'],
        'role_name'    => $r['role_name'],
        'status'       => $r['status'],
        'totp_enabled' => (int) $r['totp_enabled'] === 1,
        'permissions'  => $normalised,
        'staff_id'     => $r['staff_id'] ?? null,
        'created_at'   => $r['created_at'],
    ];
}, $stmt->fetchAll());

Response::success(['data' => $rows]);
