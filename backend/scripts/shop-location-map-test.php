<?php

declare(strict_types=1);

/**
 * Smoke test for migration 056 — shop location & pickup.
 * Run: php backend/scripts/shop-location-map-test.php
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
use App\Helpers\LocationHelper;
use App\Helpers\ShippingService;
use App\Helpers\ShopService;

$pdo = Database::pdo();

function ok(bool $cond, string $msg): void
{
    echo ($cond ? '[OK] ' : '[FAIL] ') . $msg . PHP_EOL;
    if (!$cond) {
        exit(1);
    }
}

echo "Shop location & map test\n\n";

$cols = ['street_address', 'latitude', 'longitude', 'allows_shop_pickup'];
foreach (['shops', 'shop_applications', 'company_settings'] as $table) {
    foreach ($cols as $col) {
        if ($table === 'company_settings' && !in_array($col, ['latitude', 'longitude'], true)) {
            continue;
        }
        if ($table !== 'shops' && $col === 'allows_shop_pickup' && $table === 'company_settings') {
            continue;
        }
        if ($table === 'shop_applications' && $col === 'allows_shop_pickup') {
            // included
        }
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $col]);
        $exists = (int) $stmt->fetchColumn() > 0;
        if ($table === 'company_settings' && !in_array($col, ['latitude', 'longitude'], true)) {
            continue;
        }
        ok($exists, "column {$table}.{$col}");
    }
}

$fulfillmentMode = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
);
$fulfillmentMode->execute(['shop_order_fulfillments', 'fulfillment_mode']);
ok((int) $fulfillmentMode->fetchColumn() > 0, 'column shop_order_fulfillments.fulfillment_mode');

$url = LocationHelper::googleDirectionsUrl(5.6037, -0.187);
ok(str_contains($url, 'google.com/maps/dir'), 'googleDirectionsUrl');

$shop = $pdo->query('SELECT id FROM shops ORDER BY id ASC LIMIT 1')->fetchColumn();
if ($shop !== false) {
    $formatted = ShopService::findById($pdo, (int) $shop);
    ok(is_array($formatted) && array_key_exists('has_map_pin', $formatted), 'ShopService formatRow includes has_map_pin');
}

echo "\nShippingService shop pickup keys\n";
$product = $pdo->query('SELECT id, shop_id FROM products WHERE shop_id IS NOT NULL AND status = \'active\' LIMIT 1')->fetch();
if ($product !== false) {
    $quote = ShippingService::quote($pdo, [['product_id' => (int) $product['id'], 'quantity' => 1]], false);
    ok(array_key_exists('shop_pickup_available', $quote), 'quote includes shop_pickup_available');
    ok(array_key_exists('shop_fulfillment_mode', $quote), 'quote includes shop_fulfillment_mode');
} else {
    echo "[SKIP] No shop product for quote test\n";
}

echo "\nAll checks passed.\n";
