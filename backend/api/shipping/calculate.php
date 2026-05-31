<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShippingService;

/**
 * Shipping/total quote for a cart. Accepts items via JSON body (preferred) or a
 * JSON-encoded `items` query param so both GET and POST callers work.
 */
$body = Response::body();
$items = $body['items'] ?? null;

if (!is_array($items) && isset($_GET['items'])) {
    $decoded = json_decode((string) $_GET['items'], true);
    $items = is_array($decoded) ? $decoded : null;
}

if (!is_array($items)) {
    $items = [];
}

$quote = ShippingService::quote(Database::pdo(), $items, false);

Response::success([
    'subtotal'               => $quote['subtotal'],
    'intl_shipping_cost'     => $quote['intl_shipping_cost'],
    'local_delivery_cost'    => $quote['local_delivery_cost'],
    'local_delivery_percent' => $quote['local_delivery_percent'],
    'total'                  => $quote['total'],
    'currency'               => $quote['currency'],
]);
