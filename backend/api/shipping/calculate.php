<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ClubLoyaltyService;
use App\Helpers\Response;
use App\Helpers\ShippingService;
use App\Middleware\AuthMiddleware;

$body = Response::body();
$items = $body['items'] ?? null;

if (!is_array($items) && isset($_GET['items'])) {
    $decoded = json_decode((string) $_GET['items'], true);
    $items = is_array($decoded) ? $decoded : null;
}

if (!is_array($items)) {
    $items = [];
}

$region = isset($body['region']) ? trim((string) $body['region']) : null;
if ($region === '') {
    $region = null;
}

$pickupStationId = isset($body['pickup_station_id']) ? (int) $body['pickup_station_id'] : 0;
if ($pickupStationId <= 0) {
    $pickupStationId = null;
}

$orderType = trim((string) ($body['order_type'] ?? 'retail'));
if (!in_array($orderType, ['retail', 'group', 'institutional'], true)) {
    $orderType = 'retail';
}
$organizationName = trim((string) ($body['organization_name'] ?? ''));

$shopFulfillmentMode = trim((string) ($body['shop_fulfillment_mode'] ?? 'delivery'));
if (!in_array($shopFulfillmentMode, ['delivery', 'shop_pickup'], true)) {
    $shopFulfillmentMode = 'delivery';
}

$pdo = Database::pdo();
$quote = ShippingService::quote($pdo, $items, false, $region, $pickupStationId, $shopFulfillmentMode);

$user = AuthMiddleware::optional();
if ($user !== null && in_array($orderType, ['group', 'institutional'], true)) {
    $quote = ClubLoyaltyService::apply(
        $pdo,
        $quote,
        (int) $user['id'],
        $orderType,
        $organizationName
    );
}

Response::success([
    'subtotal'               => $quote['subtotal'],
    'dpm_subtotal'           => $quote['dpm_subtotal'] ?? $quote['subtotal'],
    'shop_subtotal'          => $quote['shop_subtotal'] ?? 0,
    'has_shop_items'         => !empty($quote['has_shop_items']),
    'has_dpm_items'          => !empty($quote['has_dpm_items']),
    'intl_shipping_cost'     => $quote['intl_shipping_cost'],
    'local_delivery_cost'    => $quote['local_delivery_cost'],
    'local_delivery_percent' => $quote['local_delivery_percent'],
    'total'                  => $quote['total'],
    'currency'               => $quote['currency'],
    'delivery_explanation'   => $quote['delivery_explanation'],
    'delivery_mode'          => $quote['delivery_mode'] ?? 'address',
    'pickup_station_id'      => $quote['pickup_station_id'] ?? null,
    'shop_delivery_note'     => $quote['shop_delivery_note'] ?? null,
    'shop_pickup_available'  => !empty($quote['shop_pickup_available']),
    'shop_pickup'            => $quote['shop_pickup'] ?? null,
    'shop_fulfillment_mode'  => $quote['shop_fulfillment_mode'] ?? 'delivery',
    'discount_amount'        => $quote['discount_amount'] ?? 0,
    'discount_label'         => $quote['discount_label'] ?? null,
]);
