<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StaffPermission;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireSuperAdmin();
$pdo = Database::pdo();
$body = Response::body();

$targetId = (int) ($_GET['id'] ?? 0);
if ($targetId <= 0) {
    Response::error('Staff member not found.', 404);
}
if ($targetId === (int) $admin['id']) {
    Response::error('You cannot change your own permissions.', 422, ['code' => 'self_edit']);
}

$stmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
$stmt->execute([$targetId]);
$target = $stmt->fetch();
if ($target === false) {
    Response::error('Staff member not found.', 404);
}
if ($target['role'] === 'super_admin') {
    Response::error('Super administrator permissions cannot be modified.', 403, ['code' => 'protected']);
}

$permissions = StaffPermission::sanitize(is_array($body['permissions'] ?? null) ? $body['permissions'] : []);
$roleName = isset($body['role_name']) ? trim((string) $body['role_name']) : null;

// Upsert: staff_permissions has a unique constraint on user_id.
$exists = $pdo->prepare('SELECT id, role_name FROM staff_permissions WHERE user_id = ?');
$exists->execute([$targetId]);
$row = $exists->fetch();

if ($row === false) {
    $pdo->prepare(
        'INSERT INTO staff_permissions (user_id, role_name, permissions, created_by) VALUES (?, ?, ?, ?)'
    )->execute([$targetId, $roleName ?? 'Staff', json_encode($permissions), (int) $admin['id']]);
} else {
    $finalRole = $roleName !== null && $roleName !== '' ? $roleName : $row['role_name'];
    $pdo->prepare(
        'UPDATE staff_permissions SET role_name = ?, permissions = ? WHERE user_id = ?'
    )->execute([$finalRole, json_encode($permissions), $targetId]);
}

Response::success([
    'message'     => 'Permissions updated.',
    'id'          => $targetId,
    'permissions' => $permissions,
]);
