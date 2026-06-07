<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$shopId = $ctx['shop_id'];
$email = (string) ($ctx['shop']['contact_email'] ?? $ctx['user']['email'] ?? '');

try {
    $result = ShopBillingService::initializeRenewalPayment($pdo, $shopId, $email);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not start renewal payment.', 500);
}

Response::success($result);
