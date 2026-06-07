<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$shopId = $ctx['shop_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    Response::success(['shop' => $ctx['shop']]);
}

$body = Response::body();

try {
    $shop = ShopService::updateProfile($pdo, $shopId, $body);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Shop profile updated.', 'shop' => $shop]);
