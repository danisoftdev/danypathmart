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
$ids = $body['ids'] ?? [];

if (!is_array($ids) || $ids === []) {
    Response::error('No application ids provided.', 422);
}

$ids = array_values(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0));
if ($ids === []) {
    Response::error('No valid application ids.', 422);
}

$placeholders = implode(',', array_fill(0, count($ids), '?'));
$stmt = $pdo->prepare("DELETE FROM job_applications WHERE id IN ({$placeholders})");
$stmt->execute($ids);

Response::success(['message' => 'Deleted ' . $stmt->rowCount() . ' application(s).']);
