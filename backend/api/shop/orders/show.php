<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopFulfillmentService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid order.', 422);
}

try {
    $detail = ShopFulfillmentService::detailForShop(Database::pdo(), $ctx['shop_id'], $id);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 404);
}

Response::success(['fulfillment' => $detail]);
