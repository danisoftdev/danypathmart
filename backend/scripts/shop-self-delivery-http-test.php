<?php

declare(strict_types=1);

/**
 * HTTP-level shop checkout rules test (requires API on localhost:8000).
 *
 *   php backend/scripts/shop-self-delivery-http-test.php
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

Env::load();
$pdo = Database::pdo();
$base = rtrim((string) Env::get('APP_URL', 'http://localhost:8000'), '/');

// Issue token before any output (AuthTokens may set cookies).
$email = 'shop-test-' . time() . '@example.com';
$pdo->prepare(
    "INSERT INTO users (name, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'customer', 'active')"
)->execute(['Shop Test User', 'shoptest' . time(), $email, password_hash('testpass123', PASSWORD_BCRYPT)]);
$userId = (int) $pdo->lastInsertId();
$pdo->prepare(
    'INSERT INTO addresses (user_id, recipient_name, phone, region, city, street, is_default) VALUES (?, ?, ?, ?, ?, ?, 1)'
)->execute([$userId, 'Test Buyer', '0241111222', 'Greater Accra', 'Accra', '12 Test Lane']);
$addrId = (int) $pdo->lastInsertId();
$userStmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$userStmt->execute([$userId]);
$userRow = $userStmt->fetch(PDO::FETCH_ASSOC);
$tokens = App\Helpers\AuthTokens::issueFor($userRow);
$token = $tokens['access_token'];

$failed = 0;
$passed = 0;

function httpJson(string $method, string $url, ?array $body = null, ?string $token = null): array
{
    $headers = "Accept: application/json\r\nContent-Type: application/json\r\n";
    if ($token) {
        $headers .= "Authorization: Bearer {$token}\r\n";
    }
    $ctx = stream_context_create([
        'http' => [
            'method'        => $method,
            'header'        => $headers,
            'content'       => $body !== null ? json_encode($body) : '',
            'timeout'       => 12,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\d{3}/', $http_response_header[0], $m)) {
        $code = (int) $m[0];
    }

    return ['code' => $code, 'json' => json_decode((string) $raw, true), 'raw' => $raw];
}

function ok(bool $cond, string $label): void
{
    global $failed, $passed;
    echo ($cond ? '  [OK  ] ' : '  [FAIL] ') . $label . "\n";
    $cond ? $passed++ : $failed++;
}

echo "Shop self-delivery HTTP test\nBase: {$base}\n" . str_repeat('=', 50) . "\n";

$dpm = (int) $pdo->query('SELECT id FROM products WHERE shop_id IS NULL AND status = "active" LIMIT 1')->fetchColumn();
$shop = (int) $pdo->query(
    "SELECT id FROM products WHERE shop_id IS NOT NULL AND listing_status='approved' AND status='active' LIMIT 1"
)->fetchColumn();
$items = [
    ['product_id' => $dpm, 'quantity' => 1],
    ['product_id' => $shop, 'quantity' => 1],
];

$ship = httpJson('POST', "{$base}/shipping/calculate", [
    'items'  => $items,
    'region' => 'Greater Accra',
]);
ok($ship['code'] === 200, 'POST /shipping/calculate → 200');
$data = $ship['json']['data'] ?? $ship['json'] ?? [];
ok(!empty($data['has_shop_items']), 'Quote has_shop_items');
ok($data['local_delivery_cost'] > 0 || $data['dpm_subtotal'] > 0, 'DPM portion has shipping logic');

$noAddr = httpJson('POST', "{$base}/orders", [
    'items'          => [['product_id' => $shop, 'quantity' => 1]],
    'payment_method' => 'paystack',
], $token);
ok($noAddr['code'] === 422, 'Shop order without address → 422');
ok(($noAddr['json']['code'] ?? '') === 'address_required', 'Error code address_required');

$pdo->exec('UPDATE company_settings SET pod_enabled = 1');
$pod = httpJson('POST', "{$base}/orders", [
    'items'          => $items,
    'address_id'     => $addrId,
    'payment_method' => 'pod',
], $token);
ok($pod['code'] === 422, 'Mixed cart with POD → 422');
ok(($pod['json']['code'] ?? '') === 'shop_prepay_required', 'Error code shop_prepay_required');
$pdo->exec('UPDATE company_settings SET pod_enabled = 0');

$prepay = httpJson('POST', "{$base}/orders", [
    'items'          => $items,
    'address_id'     => $addrId,
    'payment_method' => 'paystack',
], $token);
ok($prepay['code'] === 200 || $prepay['code'] === 201, 'Mixed cart prepay order → success');
$orderId = (int) ($prepay['json']['data']['order_id'] ?? $prepay['json']['order_id'] ?? 0);
ok($orderId > 0, "Order created (#{$orderId})");

if ($orderId > 0) {
    $ff = (int) $pdo->prepare('SELECT COUNT(*) FROM shop_order_fulfillments WHERE order_id = ?')
        ->execute([$orderId]) || true;
    $ffStmt = $pdo->prepare('SELECT COUNT(*) FROM shop_order_fulfillments WHERE order_id = ?');
    $ffStmt->execute([$orderId]);
    ok((int) $ffStmt->fetchColumn() >= 1, 'Fulfillment row persisted for shop lines');

    // Dev confirm payment
    $confirm = httpJson('POST', "{$base}/payments/dev-confirm", ['order_id' => $orderId], $token);
    ok($confirm['code'] === 200, 'POST /payments/dev-confirm → 200');

    $paidStmt = $pdo->prepare('SELECT status FROM shop_order_fulfillments WHERE order_id = ?');
    $paidStmt->execute([$orderId]);
    ok(in_array('paid', $paidStmt->fetchAll(PDO::FETCH_COLUMN), true), 'Fulfillment status paid after dev confirm');

    $show = httpJson('GET', "{$base}/orders/{$orderId}", null, $token);
    $order = $show['json']['data']['order'] ?? $show['json']['order'] ?? null;
    ok(is_array($order) && count($order['shop_fulfillments'] ?? []) >= 1, 'GET /orders/{id} includes shop_fulfillments');

    // Cleanup test order
    $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([$orderId]);
}

$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

echo "\nPassed: {$passed}  Failed: {$failed}\n";
exit($failed > 0 ? 1 : 0);
