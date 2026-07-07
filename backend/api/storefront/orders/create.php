<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StorefrontOrderService;
use App\Helpers\UserCautionService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$shopSlug = trim((string) ($body['shop_slug'] ?? ''));
$items = $body['items'] ?? null;
$paymentMethod = trim((string) ($body['payment_method'] ?? ''));
$fulfillmentMode = trim((string) ($body['shop_fulfillment_mode'] ?? 'delivery'));
$addressId = isset($body['address_id']) ? (int) $body['address_id'] : null;
$notes = isset($body['notes']) ? trim((string) $body['notes']) : null;

if ($shopSlug === '' || !is_array($items) || $items === []) {
    Response::error('Shop and cart items are required.', 422);
}

if (UserCautionService::userIsRestricted($pdo, (int) $user['id'])) {
    Response::error('Your account is restricted.', 403, ['code' => 'account_restricted']);
}

try {
    $result = StorefrontOrderService::createOrder(
        $pdo,
        (int) $user['id'],
        $shopSlug,
        $items,
        $paymentMethod,
        $fulfillmentMode,
        $addressId,
        $notes
    );
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success($result, 201);
