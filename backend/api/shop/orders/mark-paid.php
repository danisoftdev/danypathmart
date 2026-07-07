<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StorefrontOrderService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid order.', 422);
}

$pdo = Database::pdo();

try {
    StorefrontOrderService::markPaidByShop($pdo, $ctx['shop_id'], $id, (int) $ctx['user']['id']);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Payment marked as received.']);
