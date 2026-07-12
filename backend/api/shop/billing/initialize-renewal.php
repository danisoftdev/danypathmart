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
$body = Response::body();
$period = isset($body['period']) ? trim((string) $body['period']) : null;

try {
    $result = ShopBillingService::initializeRenewalPayment($pdo, $shopId, $email, $period);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not start renewal payment.', 500);
}

Response::success($result);
