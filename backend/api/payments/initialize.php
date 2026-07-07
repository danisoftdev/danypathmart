<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\PaymentSettings;
use App\Helpers\Response;
use App\Helpers\ShopService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$orderId = (int) ($body['order_id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order id is required.', 422);
}

$stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
$stmt->execute([$orderId, $user['id']]);
$order = $stmt->fetch();
if ($order === false) {
    Response::error('Order not found.', 404);
}
if ($order['payment_status'] === 'paid') {
    Response::error('This order has already been paid.', 409, ['code' => 'already_paid']);
}

$paymentSettings = PaymentSettings::get($pdo);
if (!$paymentSettings['paystack_enabled']) {
    Response::error('Card and mobile money payments are not available right now.', 503, [
        'code' => 'paystack_disabled',
    ]);
}

$amountDue = \App\Helpers\OrderService::amountDue($order);
$amount = (int) round($amountDue * 100); // pesewas
if ($amount <= 0) {
    Response::error('This order has no remaining balance to pay online.', 422, ['code' => 'nothing_due']);
}

$secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
$configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');
$frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
$callbackUrl = $frontend . '/order/' . $orderId;

$recordPayment = static function (string $ref, int $amount) use ($pdo, $orderId): void {
    $pdo->prepare(
        'INSERT INTO payments (order_id, paystack_ref, amount, status)
         VALUES (?, ?, ?, \'pending\')
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)'
    )->execute([$orderId, $ref, $amount / 100]);
    $pdo->prepare('UPDATE orders SET payment_ref = ? WHERE id = ?')->execute([$ref, $orderId]);
};

// Development fallback: no real Paystack key -> issue a mock reference the
// frontend can confirm via the dev-confirm endpoint, keeping the flow testable.
if (!$configured) {
    $ref = 'DEV-' . bin2hex(random_bytes(8));
    $recordPayment($ref, $amount);
    Response::success([
        'dev_mock'          => true,
        'reference'         => $ref,
        'authorization_url' => $callbackUrl . '?mock=1&reference=' . $ref,
        'message'           => 'Paystack not configured; using development mock.',
    ]);
}

$payloadData = [
    'email'        => $user['email'],
    'amount'       => $amount,
    'currency'     => 'GHS',
    'channels'     => ['card', 'mobile_money'],
    'callback_url' => $callbackUrl,
    'metadata'     => [
        'order_id' => $orderId,
        'user_id'  => (int) $user['id'],
        'payment_collector' => $order['payment_collector'] ?? 'dpm',
    ],
];

if (($order['payment_collector'] ?? 'dpm') === 'shop') {
    $shopId = (int) ($order['storefront_shop_id'] ?? 0);
    $shop = $shopId > 0 ? ShopService::findById($pdo, $shopId) : null;
    $subaccount = $shop['paystack_subaccount_code'] ?? null;
    if ($subaccount === null || trim((string) $subaccount) === '') {
        Response::error('This shop cannot accept online payments right now.', 422, ['code' => 'shop_paystack_unavailable']);
    }
    $payloadData['subaccount'] = trim((string) $subaccount);
    $payloadData['bearer'] = 'account';
}

$payload = json_encode($payloadData);

$ch = curl_init('https://api.paystack.co/transaction/initialize');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $secret,
        'Content-Type: application/json',
        'Cache-Control: no-cache',
    ],
    CURLOPT_TIMEOUT        => 20,
]);
$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    Response::error('Could not reach the payment gateway.', 502, ['detail' => $curlErr]);
}

$data = json_decode((string) $response, true);
if ($httpCode >= 400 || !is_array($data) || empty($data['status']) || empty($data['data']['authorization_url'])) {
    $msg = is_array($data) && isset($data['message']) ? (string) $data['message'] : 'Payment initialization failed.';
    Response::error($msg, 502);
}

$ref = (string) $data['data']['reference'];
$recordPayment($ref, $amount);

Response::success([
    'dev_mock'          => false,
    'reference'         => $ref,
    'access_code'       => $data['data']['access_code'] ?? null,
    'authorization_url' => (string) $data['data']['authorization_url'],
    'public_key'        => Env::get('PAYSTACK_PUBLIC_KEY'),
]);
