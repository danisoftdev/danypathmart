<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$pdo = Database::pdo();
$body = Response::body();
$ids = $body['ids'] ?? [];

if (!is_array($ids)) {
    Response::error('Select at least one message to delete.', 422);
}

$ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
if ($ids === []) {
    Response::error('Select at least one message to delete.', 422);
}

$placeholders = implode(',', array_fill(0, count($ids), '?'));
$stmt = $pdo->prepare("DELETE FROM contact_messages WHERE id IN ({$placeholders})");
$stmt->execute($ids);

Response::success([
    'message' => 'Deleted ' . $stmt->rowCount() . ' message(s).',
    'deleted' => $stmt->rowCount(),
]);
