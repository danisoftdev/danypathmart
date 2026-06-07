<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\KitBuilderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$body = Response::body();

$id = KitBuilderService::create($pdo, [
    'name'         => $body['name'] ?? '',
    'slug'         => $body['slug'] ?? null,
    'description'  => $body['description'] ?? null,
    'leader_note'  => $body['leader_note'] ?? null,
    'image_url'    => $body['image_url'] ?? null,
    'is_published' => $body['is_published'] ?? false,
    'sort_order'   => $body['sort_order'] ?? 0,
    'items'        => is_array($body['items'] ?? null) ? $body['items'] : [],
]);

Response::success([
    'message' => 'Kit template created.',
    'id'      => $id,
    'kit'     => KitBuilderService::getById($pdo, $id, true, false),
], 201);
