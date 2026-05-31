<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireSuperAdmin();
$pdo = Database::pdo();

$targetId = (int) ($_GET['id'] ?? 0);
if ($targetId <= 0) {
    Response::error('Staff member not found.', 404);
}
if ($targetId === (int) $admin['id']) {
    Response::error('You cannot delete your own account.', 422, ['code' => 'self_delete']);
}

$stmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
$stmt->execute([$targetId]);
$target = $stmt->fetch();
if ($target === false) {
    Response::error('Staff member not found.', 404);
}
if ($target['role'] === 'super_admin') {
    Response::error('A super administrator account cannot be deleted.', 403, ['code' => 'protected']);
}
if ($target['role'] !== 'staff') {
    Response::error('Only staff accounts can be removed here.', 422, ['code' => 'not_staff']);
}

// staff_permissions cascades on user delete.
$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$targetId]);

Response::success(['message' => 'Staff account removed.', 'id' => $targetId]);
