<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingReceiptService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$body = Response::body();

$enabled = !empty($body['auto_renew']);
$period = isset($body['period']) ? trim((string) $body['period']) : null;

if ($enabled && ShopBillingReceiptService::listPaymentMethods($pdo, $ctx['shop_id']) === []) {
    Response::error('Add a card before turning on automatic renewal.', 422, ['code' => 'card_required']);
}

try {
    ShopBillingReceiptService::setAutoRenew($pdo, $ctx['shop_id'], $enabled, $period);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'      => $enabled ? 'Automatic renewal enabled.' : 'Automatic renewal turned off.',
    'auto_renew'   => $enabled,
    'subscription' => \App\Helpers\ShopBillingService::subscriptionForShop($pdo, $ctx['shop_id']),
]);
