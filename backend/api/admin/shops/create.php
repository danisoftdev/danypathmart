<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('create_shop_manual');

$pdo = Database::pdo();
$body = Response::body();

try {
    $shop = ShopService::create($pdo, $body);
    if (!empty($body['owner_user_id'])) {
        ShopService::addOwner($pdo, (int) $shop['id'], (int) $body['owner_user_id']);
    }
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create shop.', 500);
}

Response::success(['message' => 'Shop created.', 'shop' => $shop], 201);
