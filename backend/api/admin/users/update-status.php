<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('edit_users');

$pdo = Database::pdo();
$userId = (int) ($_GET['id'] ?? 0);
if ($userId <= 0) {
    Response::error('User not found.', 404);
}

$body = Response::body();
$status = trim((string) ($body['status'] ?? ''));
if (!in_array($status, ['verified', 'disabled'], true)) {
    Response::error('Status must be verified or disabled.', 422);
}

$stmt = $pdo->prepare("SELECT id, role FROM users WHERE id = ? AND role = 'customer'");
$stmt->execute([$userId]);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Customer not found.', 404);
}

$pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);

Response::success(['message' => 'Customer status updated.', 'id' => $userId, 'status' => $status]);
