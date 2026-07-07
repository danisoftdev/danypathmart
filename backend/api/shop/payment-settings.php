<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$body = Response::body();

try {
    $shop = ShopService::updatePaymentSettings($pdo, $ctx['shop_id'], $body);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Payment settings saved.', 'shop' => $shop]);
