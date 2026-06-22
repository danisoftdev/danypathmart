<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopFulfillmentService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$fulfillments = ShopFulfillmentService::listForShop($pdo, $ctx['shop_id']);

Response::success(['data' => $fulfillments]);
