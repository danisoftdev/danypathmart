<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingReceiptService;
use App\Helpers\ShopBillingService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$shopId = $ctx['shop_id'];

$payments = ShopBillingReceiptService::listForShop($pdo, $shopId);
$methods = ShopBillingReceiptService::listPaymentMethods($pdo, $shopId);
$subscription = ShopBillingService::subscriptionForShop($pdo, $shopId);
$settings = ShopBillingService::publicSettings($pdo);

Response::success([
    'payments'     => $payments,
    'methods'      => $methods,
    'subscription' => $subscription,
    'settings'     => $settings,
]);
