<?php

declare(strict_types=1);

/**
 * Shop self-delivery integration test (local / staging DB).
 *
 *   php backend/scripts/shop-self-delivery-test.php
 */

require __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));
    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Database;
use App\Config\Env;
use App\Helpers\ShippingService;
use App\Helpers\ShopFulfillmentService;

$failed = 0;
$passed = 0;

function assertTrue(bool $cond, string $label): void
{
    global $failed, $passed;
    if ($cond) {
        echo "  [OK  ] {$label}\n";
        $passed++;
    } else {
        echo "  [FAIL] {$label}\n";
        $failed++;
    }
}

function assertEq(mixed $a, mixed $b, string $label): void
{
    assertTrue($a === $b, "{$label} (expected " . json_encode($b) . ", got " . json_encode($a) . ')');
}

echo "Shop self-delivery integration test\n" . str_repeat('=', 50) . "\n";
Env::load();

try {
    $pdo = Database::pdo();
} catch (Throwable $e) {
    echo "Database connection failed: {$e->getMessage()}\n";
    exit(1);
}

// Migration 053 tables
echo "\n1. Schema\n";
$tables = ['shop_order_fulfillments', 'shop_fulfillment_tracking'];
foreach ($tables as $t) {
    $exists = (int) $pdo->query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{$t}'"
    )->fetchColumn() === 1;
    assertTrue($exists, "Table {$t} exists (run migration 053 if missing)");
}

$releaseOn = $pdo->query('SELECT shop_earnings_release_on FROM company_settings ORDER BY id DESC LIMIT 1')->fetchColumn();
assertEq($releaseOn, 'paid', 'shop_earnings_release_on = paid');

// Sample products
echo "\n2. Product fixtures\n";
$dpm = $pdo->query(
    "SELECT id, name, price FROM products WHERE shop_id IS NULL AND status = 'active' AND is_preorder = 0 LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);
$shop = $pdo->query(
    "SELECT p.id, p.name, p.price, p.shop_id FROM products p
     INNER JOIN shops s ON s.id = p.shop_id
     WHERE p.shop_id IS NOT NULL AND p.listing_status = 'approved' AND p.status = 'active' AND p.is_preorder = 0
     LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);
$shopPre = $pdo->query(
    "SELECT id FROM products WHERE shop_id IS NOT NULL AND is_preorder = 1 LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);

assertTrue($dpm !== false, 'Found at least one DPM catalog product');
assertTrue($shop !== false, 'Found at least one approved shop product');

if ($dpm === false || $shop === false) {
    echo "\nCannot continue without DPM + shop products. Seed marketplace data first.\n";
    exit($failed > 0 ? 1 : 0);
}

echo "       DPM product #{$dpm['id']} — {$dpm['name']}\n";
echo "       Shop product #{$shop['id']} — {$shop['name']} (shop #{$shop['shop_id']})\n";

// Shipping quotes
echo "\n3. ShippingService::quote\n";

$mixed = ShippingService::quote($pdo, [
    ['product_id' => (int) $dpm['id'], 'quantity' => 1],
    ['product_id' => (int) $shop['id'], 'quantity' => 2],
], false, 'Greater Accra');

assertTrue($mixed['has_shop_items'] === true, 'Mixed cart: has_shop_items');
assertTrue($mixed['has_dpm_items'] === true, 'Mixed cart: has_dpm_items');
assertTrue($mixed['shop_subtotal'] > 0, 'Mixed cart: shop_subtotal > 0');
assertTrue($mixed['dpm_subtotal'] > 0, 'Mixed cart: dpm_subtotal > 0');
assertTrue($mixed['shop_delivery_note'] !== null, 'Mixed cart: shop_delivery_note set');
assertTrue($mixed['delivery_mode'] === 'address', 'Mixed cart: delivery_mode = address');

$expectedDpm = round((float) $dpm['price'], 2);
$expectedShop = round((float) $shop['price'] * 2, 2);
assertEq($mixed['dpm_subtotal'], $expectedDpm, 'Mixed cart dpm_subtotal matches DPM line');
assertEq($mixed['shop_subtotal'], $expectedShop, 'Mixed cart shop_subtotal matches shop lines');

$settings = ShippingService::settings($pdo);
$expectedLocal = round($expectedDpm * ($settings['local_delivery_percent'] / 100.0), 2);
assertEq($mixed['local_delivery_cost'], $expectedLocal, 'Local delivery charged on DPM subtotal only');

$shopOnly = ShippingService::quote($pdo, [
    ['product_id' => (int) $shop['id'], 'quantity' => 1],
], false, 'Ashanti');
assertTrue($shopOnly['has_shop_items'] === true, 'Shop-only: has_shop_items');
assertTrue($shopOnly['has_dpm_items'] === false, 'Shop-only: no dpm items');
assertEq($shopOnly['local_delivery_cost'], 0.0, 'Shop-only: no DPM local delivery fee');

$stationId = (int) $pdo->query('SELECT id FROM pickup_stations WHERE is_active = 1 LIMIT 1')->fetchColumn();
if ($stationId > 0) {
    $mixedPickup = ShippingService::quote($pdo, [
        ['product_id' => (int) $dpm['id'], 'quantity' => 1],
        ['product_id' => (int) $shop['id'], 'quantity' => 1],
    ], false, null, $stationId);
    assertTrue($mixedPickup['delivery_mode'] === 'address', 'Mixed cart + pickup station id → still address mode');
    assertTrue($mixedPickup['pickup_station_id'] === null, 'Mixed cart does not assign pickup_station_id');

    $dpmPickup = ShippingService::quote($pdo, [
        ['product_id' => (int) $dpm['id'], 'quantity' => 1],
    ], false, null, $stationId);
    assertTrue($dpmPickup['delivery_mode'] === 'pickup', 'DPM-only cart can use pickup');
} else {
    echo "  [WARN] No active pickup station — skipping pickup mode tests\n";
}

if ($shopPre !== false) {
    $preQuote = ShippingService::quote($pdo, [
        ['product_id' => (int) $shopPre['id'], 'quantity' => 1],
    ], false, 'Greater Accra');
    $hasPreError = false;
    foreach ($preQuote['errors'] as $err) {
        if (($err['error'] ?? '') === 'shop_preorder_not_allowed') {
            $hasPreError = true;
        }
    }
    assertTrue($hasPreError, 'Shop pre-order product rejected in quote');
} else {
    echo "  [WARN] No shop pre-order product in DB — skipping pre-order block test\n";
}

// Fulfillment lifecycle (transaction rolled back)
echo "\n4. ShopFulfillmentService lifecycle (rolled back)\n";
$pdo->beginTransaction();
try {
    $userId = (int) $pdo->query("SELECT id FROM users WHERE role = 'customer' LIMIT 1")->fetchColumn();
    if ($userId <= 0) {
        $userId = (int) $pdo->query('SELECT id FROM users ORDER BY id ASC LIMIT 1')->fetchColumn();
    }
    assertTrue($userId > 0, 'Found a user for test order');

    $addrId = (int) $pdo->prepare('SELECT id FROM addresses WHERE user_id = ? LIMIT 1')
        ->execute([$userId]) || true;
    $addrStmt = $pdo->prepare('SELECT id FROM addresses WHERE user_id = ? LIMIT 1');
    $addrStmt->execute([$userId]);
    $addrId = (int) $addrStmt->fetchColumn();

    if ($addrId <= 0) {
        $pdo->prepare(
            'INSERT INTO addresses (user_id, recipient_name, phone, region, city, street, is_default)
             VALUES (?, ?, ?, ?, ?, ?, 1)'
        )->execute([$userId, 'Test Buyer', '0240000000', 'Greater Accra', 'Accra', 'Test Street 1']);
        $addrId = (int) $pdo->lastInsertId();
    }

    $subtotal = $mixed['subtotal'];
    $total = $mixed['total'];
    $pdo->prepare(
        'INSERT INTO orders (user_id, address_id, status, payment_status, subtotal, intl_shipping_cost,
         local_delivery_cost, local_delivery_percent, total, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $userId, $addrId, 'pending', 'pending', $subtotal,
        $mixed['intl_shipping_cost'], $mixed['local_delivery_cost'],
        $mixed['local_delivery_percent'], $total, 'paystack',
    ]);
    $orderId = (int) $pdo->lastInsertId();
    assertTrue($orderId > 0, "Created test order #{$orderId}");

    foreach ($mixed['lines'] as $line) {
        $pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, is_preorder)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $orderId,
            (int) $line['product']['id'],
            (int) $line['quantity'],
            (float) $line['unit_price'],
            $line['is_preorder'] ? 1 : 0,
        ]);
    }

    ShopFulfillmentService::createForOrder($pdo, $orderId, $mixed['lines']);
    $ffCount = (int) $pdo->prepare('SELECT COUNT(*) FROM shop_order_fulfillments WHERE order_id = ?')
        ->execute([$orderId]) || true;
    $ffStmt = $pdo->prepare('SELECT COUNT(*) FROM shop_order_fulfillments WHERE order_id = ?');
    $ffStmt->execute([$orderId]);
    $ffCount = (int) $ffStmt->fetchColumn();
    assertTrue($ffCount >= 1, 'Fulfillment row created for shop lines');

    ShopFulfillmentService::markPaidForOrder($pdo, $orderId);
    $paidStatus = $pdo->prepare('SELECT status FROM shop_order_fulfillments WHERE order_id = ?');
    $paidStatus->execute([$orderId]);
    $statuses = $paidStatus->fetchAll(PDO::FETCH_COLUMN);
    assertTrue(in_array('paid', $statuses, true), 'Fulfillment moves to paid after payment');

    $fid = (int) $pdo->prepare('SELECT id FROM shop_order_fulfillments WHERE order_id = ? LIMIT 1')
        ->execute([$orderId]) || true;
    $fidStmt = $pdo->prepare('SELECT id FROM shop_order_fulfillments WHERE order_id = ? LIMIT 1');
    $fidStmt->execute([$orderId]);
    $fid = (int) $fidStmt->fetchColumn();

    ShopFulfillmentService::updateStatus($pdo, (int) $shop['shop_id'], $fid, 'preparing', $userId, null);
    ShopFulfillmentService::updateStatus($pdo, (int) $shop['shop_id'], $fid, 'out_for_delivery', $userId, 'On the way');
    ShopFulfillmentService::updateStatus($pdo, (int) $shop['shop_id'], $fid, 'delivered', $userId, null);
    $final = $pdo->prepare('SELECT status FROM shop_order_fulfillments WHERE id = ?');
    $final->execute([$fid]);
    assertEq($final->fetchColumn(), 'delivered', 'Seller can progress preparing → out_for_delivery → delivered');

    $customerList = ShopFulfillmentService::listForCustomerOrder($pdo, $orderId);
    assertTrue(count($customerList) >= 1, 'Customer order detail includes shop fulfillments');
    assertTrue(count($customerList[0]['tracking'] ?? []) >= 4, 'Tracking history includes payment + delivery steps');
} finally {
    $pdo->rollBack();
    echo "  [....] Test order rolled back (no DB pollution)\n";
}

// HTTP smoke (optional)
echo "\n5. HTTP API (if server running)\n";
$base = rtrim((string) Env::get('APP_URL', 'http://localhost:8000'), '/');
$ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);

$shipBody = json_encode([
    'items' => [
        ['product_id' => (int) $dpm['id'], 'quantity' => 1],
        ['product_id' => (int) $shop['id'], 'quantity' => 1],
    ],
    'region' => 'Greater Accra',
]);
$shipCtx = stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $shipBody,
        'timeout' => 8,
        'ignore_errors' => true,
    ],
]);
$resp = @file_get_contents("{$base}/shipping/calculate", false, $shipCtx);
if ($resp === false) {
    echo "  [WARN] API not reachable at {$base} — start: php -S localhost:8000 -t backend backend/index.php\n";
} else {
    $json = json_decode($resp, true);
    $data = $json['data'] ?? $json;
    assertTrue(!empty($data['has_shop_items']), 'POST /shipping/calculate exposes has_shop_items');
    assertTrue(!empty($data['shop_delivery_note']), 'POST /shipping/calculate exposes shop_delivery_note');
    assertTrue(isset($data['dpm_subtotal']), 'POST /shipping/calculate exposes dpm_subtotal');
}

echo "\n" . str_repeat('=', 50) . "\n";
echo "Passed: {$passed}  Failed: {$failed}\n";
exit($failed > 0 ? 1 : 0);
