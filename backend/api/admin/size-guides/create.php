<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$body = Response::body();

$id = SizeGuideService::create($pdo, [
    'name'  => $body['name'] ?? '',
    'notes' => $body['notes'] ?? null,
    'rows'  => is_array($body['rows'] ?? null) ? $body['rows'] : [],
]);

Response::success([
    'message' => 'Size guide created.',
    'id'      => $id,
    'guide'   => SizeGuideService::getById($pdo, $id, true),
], 201);
