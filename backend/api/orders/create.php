<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ClubLoyaltyService;
use App\Helpers\CustomProofService;
use App\Helpers\NotificationService;
use App\Helpers\PaymentSettings;
use App\Helpers\PickupStationService;
use App\Helpers\PlatformFeatures;
use App\Helpers\ReferralService;
use App\Helpers\Response;
use App\Helpers\ShippingService;
use App\Helpers\ShopFulfillmentService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$items = $body['items'] ?? null;
if (!is_array($items) || $items === []) {
    Response::error('Your cart is empty.', 422, ['code' => 'empty_cart']);
}

$addressId = isset($body['address_id']) ? (int) $body['address_id'] : 0;
if ($addressId > 0) {
    $chk = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
    $chk->execute([$addressId, $user['id']]);
    if ($chk->fetchColumn() === false) {
        Response::error('Delivery address not found.', 422, ['code' => 'bad_address']);
    }
} else {
    $addressId = null;
}

$notes = isset($body['notes']) ? trim((string) $body['notes']) : '';
$notifyWhatsapp = !empty($body['notify_whatsapp']);
$customizations = $body['customizations'] ?? [];
if (!is_array($customizations)) {
    $customizations = [];
}
$orderType = trim((string) ($body['order_type'] ?? 'retail'));
if (!in_array($orderType, ['retail', 'group', 'institutional'], true)) {
    Response::error('Invalid order type.', 422);
}
$organizationName = isset($body['organization_name']) ? trim((string) $body['organization_name']) : '';
if ($orderType === 'group' && $organizationName === '') {
    Response::error('Organization or group name is required for group orders.', 422);
}
$referralCode = isset($body['referral_code']) ? trim((string) $body['referral_code']) : '';
$paymentMethod = trim((string) ($body['payment_method'] ?? 'paystack'));
$allowedMethods = ['paystack', 'wallet', 'bank_transfer', 'pod'];
if (!in_array($paymentMethod, $allowedMethods, true)) {
    Response::error('Invalid payment method.', 422);
}
PaymentSettings::assertMethodEnabled($pdo, $paymentMethod === 'wallet' ? 'wallet' : $paymentMethod);

$features = PlatformFeatures::load($pdo);
$pickupEnabled = $features['pickup_stations_enabled'];
$pickupStationId = isset($body['pickup_station_id']) ? (int) $body['pickup_station_id'] : 0;
$pickupStation = null;
$pickupSnapshot = null;

$quoteRegion = null;
if ($addressId !== null) {
    $regionStmt = $pdo->prepare('SELECT region FROM addresses WHERE id = ? AND user_id = ?');
    $regionStmt->execute([$addressId, $user['id']]);
    $quoteRegion = $regionStmt->fetchColumn();
    $quoteRegion = $quoteRegion !== false ? (string) $quoteRegion : null;
}

// Server recomputes everything from the database (prices, freight, stock).
$quote = ShippingService::quote(
    $pdo,
    $items,
    true,
    $quoteRegion,
    $pickupStationId > 0 ? $pickupStationId : null
);

if ($quote['errors'] !== []) {
    Response::error('Some items are unavailable or out of stock.', 422, [
        'code'   => 'cart_invalid',
        'errors' => $quote['errors'],
    ]);
}
if ($quote['lines'] === []) {
    Response::error('Your cart is empty.', 422, ['code' => 'empty_cart']);
}

$hasShopItems = !empty($quote['has_shop_items']);
$hasDpmItems = !empty($quote['has_dpm_items']);

if ($hasShopItems) {
    if ($addressId === null) {
        Response::error('A delivery address is required for marketplace items.', 422, ['code' => 'address_required']);
    }
    if ($paymentMethod === 'pod') {
        Response::error('Marketplace items must be paid in the app before delivery. Pay on delivery is not available for seller products.', 422, ['code' => 'shop_prepay_required']);
    }
    $pickupStationId = 0;
}

if ($pickupEnabled && $hasDpmItems && !$hasShopItems) {
    if ($pickupStationId <= 0) {
        Response::error('Please choose a pickup station.', 422, ['code' => 'bad_pickup_station']);
    }
    $pickupStation = PickupStationService::findActive($pdo, $pickupStationId);
    if ($pickupStation === null) {
        Response::error('Pickup station not found or inactive.', 422, ['code' => 'bad_pickup_station']);
    }
    $pickupSnapshot = PickupStationService::buildSnapshot($pickupStation);
} else {
    $pickupStationId = 0;
    if ($hasDpmItems && !$hasShopItems && $addressId === null && !$pickupEnabled) {
        Response::error('Please choose a delivery address.', 422, ['code' => 'address_required']);
    }
}

if (in_array($orderType, ['group', 'institutional'], true)) {
    $quote = ClubLoyaltyService::apply(
        $pdo,
        $quote,
        (int) $user['id'],
        $orderType,
        $organizationName
    );
}

$discountAmount = round((float) ($quote['discount_amount'] ?? 0), 2);
$discountLabel = isset($quote['discount_label']) ? (string) $quote['discount_label'] : null;

$pdo->beginTransaction();
try {
    $orderStmt = $pdo->prepare(
        'INSERT INTO orders
            (user_id, address_id, pickup_station_id, pickup_station_snapshot, status, subtotal, intl_shipping_cost,
             local_delivery_cost, local_delivery_percent, total, discount_amount, discount_label,
             payment_status, payment_method, notes,
             notify_whatsapp, order_type, organization_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $orderStmt->execute([
        $user['id'],
        $addressId,
        $pickupStationId > 0 ? $pickupStationId : null,
        $pickupSnapshot !== null ? json_encode($pickupSnapshot) : null,
        'placed',
        $quote['subtotal'],
        $quote['intl_shipping_cost'],
        $quote['local_delivery_cost'],
        $quote['local_delivery_percent'],
        $quote['total'],
        $discountAmount,
        $discountLabel,
        'pending',
        $paymentMethod === 'paystack' ? null : $paymentMethod,
        $notes !== '' ? $notes : null,
        $notifyWhatsapp ? 1 : 0,
        $orderType,
        $organizationName !== '' ? $organizationName : null,
    ]);
    $orderId = (int) $pdo->lastInsertId();

    $itemStmt = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, unit_cbm_cost, is_preorder, estimated_arrival, recipient_name, size_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $usdRate = $quote['lines'] !== [] ? ShippingService::settings($pdo)['usd_to_ghs_rate'] : 0.0;

    $lineMeta = [];
    foreach ($items as $raw) {
        $pid = (int) ($raw['product_id'] ?? 0);
        if ($pid <= 0) {
            continue;
        }
        $recipient = isset($raw['recipient_name']) ? trim((string) $raw['recipient_name']) : '';
        $size = isset($raw['size_label']) ? trim((string) $raw['size_label']) : '';
        $lineMeta[] = [
            'product_id'     => $pid,
            'quantity'       => max(1, (int) ($raw['quantity'] ?? 1)),
            'recipient_name' => $recipient !== '' ? $recipient : null,
            'size_label'     => $size !== '' ? $size : null,
        ];
    }

    $pricedByProduct = [];
    foreach ($quote['lines'] as $line) {
        $pricedByProduct[(int) $line['product']['id']] = $line;
    }

    if ($orderType === 'group' && $lineMeta !== []) {
        foreach ($lineMeta as $meta) {
            $pid = (int) $meta['product_id'];
            if (!isset($pricedByProduct[$pid])) {
                continue;
            }
            $line = $pricedByProduct[$pid];
            $product = $line['product'];
            $qty = (int) $meta['quantity'];
            $unitCost = (float) ($product['cost_price'] ?? 0);
            $unitCbm = $line['is_preorder']
                ? ShippingService::intlFreightPerUnit($product, $usdRate)
                : 0.0;

            $itemStmt->execute([
                $orderId,
                $pid,
                $qty,
                $line['unit_price'],
                $unitCost,
                $unitCbm,
                $line['is_preorder'] ? 1 : 0,
                $line['estimated_arrival'],
                $meta['recipient_name'],
                $meta['size_label'],
            ]);
        }

        foreach ($quote['lines'] as $line) {
            if (!$line['is_preorder']) {
                // Stock committed on payment (or POD below) via InventoryService
            }
        }
    } else {
        foreach ($quote['lines'] as $line) {
            $product = $line['product'];
            $unitCost = (float) ($product['cost_price'] ?? 0);
            $unitCbm = $line['is_preorder']
                ? ShippingService::intlFreightPerUnit($product, $usdRate)
                : 0.0;

            $itemStmt->execute([
                $orderId,
                (int) $product['id'],
                (int) $line['quantity'],
                $line['unit_price'],
                $unitCost,
                $unitCbm,
                $line['is_preorder'] ? 1 : 0,
                $line['estimated_arrival'],
                null,
                null,
            ]);

            // Stock committed on payment (or POD below) via InventoryService
        }
    }

    $trackNote = match ($paymentMethod) {
        'bank_transfer' => 'Order placed — complete your bank transfer to confirm payment.',
        'pod'           => $pickupEnabled
            ? 'Order placed — pay when you collect at your pickup station.'
            : 'Order placed — pay the driver in cash on delivery.',
        'wallet'        => 'Order placed — apply wallet credit to pay.',
        default         => $pickupEnabled
            ? 'Order placed — we will notify you when ready for pickup.'
            : 'Order placed, awaiting payment.',
    };
    $pdo->prepare(
        "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'placed', ?, ?)"
    )->execute([$orderId, $trackNote, $user['id']]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

ShopFulfillmentService::createForOrder($pdo, $orderId, $quote['lines']);

$invSettings = InventoryService::displaySettings($pdo);
if (!$invSettings['stock_decrement_on_payment'] || InventoryService::shouldCommitOnOrderCreate($paymentMethod)) {
    InventoryService::commitOrderInventory($pdo, $orderId);
}

if ($referralCode !== '') {
    ReferralService::attachToOrder($pdo, $orderId, (int) $user['id'], $referralCode);
}

if ($customizations !== []) {
    CustomProofService::attachToOrder($pdo, $orderId, $customizations);
}

if ($paymentMethod === 'pod') {
    $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
    $podBody = $pickupEnabled
        ? 'Your order is placed. Pay in Ghana Cedis when you collect at your pickup station. Order total: '
        : 'Your order is placed. Pay the delivery driver in Ghana Cedis when your items arrive. Order total: ';
    NotificationService::notifyUser(
        $pdo,
        (int) $user['id'],
        "Order {$trackingRef} — Pay on " . ($pickupEnabled ? 'collection' : 'delivery'),
        $podBody . number_format($quote['total'], 2) . ' GHS.',
        '/dashboard/orders/' . $orderId,
        'order_update'
    );
}

NotificationService::notifyNewOrder(
    $pdo,
    $orderId,
    $user,
    (float) $quote['total'],
    (string) ($paymentMethod === 'paystack' ? 'paystack' : $paymentMethod),
    $organizationName !== '' ? $organizationName : null
);

Response::success([
    'order_id'         => $orderId,
    'total'            => $quote['total'],
    'currency'         => $quote['currency'],
    'payment_method'   => $paymentMethod,
    'notify_whatsapp'  => $notifyWhatsapp,
], 201);
