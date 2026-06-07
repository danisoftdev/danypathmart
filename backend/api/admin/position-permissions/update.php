<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PositionPermissionService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAnyPermission(['manage_staff', 'manage_position_permissions']);

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Position type is required.', 422);
}

$pdo = Database::pdo();
$body = Response::body();

try {
    $permissions = PositionPermissionService::saveTemplate(
        $pdo,
        $slug,
        is_array($body['permissions'] ?? null) ? $body['permissions'] : []
    );
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'     => 'Default permissions saved for this position.',
    'role_slug'   => $slug,
    'permissions' => $permissions,
]);
