<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$pdo = Database::pdo();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Message not found.', 404);
}

$stmt = $pdo->prepare('DELETE FROM contact_messages WHERE id = ?');
$stmt->execute([$id]);

if ($stmt->rowCount() === 0) {
    Response::error('Message not found.', 404);
}

Response::success(['message' => 'Message deleted.']);
