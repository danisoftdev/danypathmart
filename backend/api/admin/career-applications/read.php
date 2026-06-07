<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings', 'hire_employees']);

$pdo = Database::pdo();
$body = Response::body();
$ids = $body['ids'] ?? null;

if (is_array($ids) && count($ids) > 0) {
    $ids = array_values(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0));
    if ($ids === []) {
        Response::error('No valid application ids.', 422);
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("UPDATE job_applications SET is_read = 1 WHERE id IN ({$placeholders})")
        ->execute($ids);
} else {
    $pdo->exec('UPDATE job_applications SET is_read = 1');
}

Response::success(['message' => 'Marked as read.']);
