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
$ids = $body['ids'] ?? null;

if (is_array($ids) && $ids !== []) {
    $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
    if ($ids === []) {
        Response::success(['message' => 'Nothing to mark.']);
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("UPDATE contact_messages SET is_read = 1 WHERE id IN ({$placeholders})")
        ->execute($ids);
} else {
    $pdo->exec('UPDATE contact_messages SET is_read = 1');
}

Response::success(['message' => 'Marked as read.']);
