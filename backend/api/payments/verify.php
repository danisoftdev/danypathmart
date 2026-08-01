<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

/**
 * Confirm a Paystack charge from the browser after redirect (does not rely only on webhooks).
 */
$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$orderId = (int) ($body['order_id'] ?? 0);
$reference = trim((string) ($body['reference'] ?? ''));

if ($orderId <= 0) {
    Response::error('Order id is required.', 422);
}

$stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
$stmt->execute([$orderId, $user['id']]);
$order = $stmt->fetch();
if ($order === false) {
    Response::error('Order not found.', 404);
}

if (($order['payment_status'] ?? '') === 'paid') {
    Response::success([
        'order_id'       => $orderId,
        'payment_status' => 'paid',
        'message'        => 'Payment already confirmed.',
    ]);
}

if ($reference === '') {
    $reference = trim((string) ($order['payment_ref'] ?? ''));
}
if ($reference === '') {
    Response::error('Payment reference is required.', 422);
}

// Development mock references.
if (str_starts_with($reference, 'DEV-') && !Env::isProduction()) {
    OrderService::markPaid($pdo, $orderId, $reference, 'dev', ['verified_client' => true]);
    Response::success([
        'order_id'       => $orderId,
        'payment_status' => 'paid',
        'message'        => 'Payment confirmed.',
    ]);
}

$secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
if ($secret === '' || str_contains($secret, 'xxxx') || !str_starts_with($secret, 'sk_')) {
    Response::error('Payment verification is unavailable right now.', 503);
}

$ch = curl_init('https://api.paystack.co/transaction/verify/' . rawurlencode($reference));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $secret,
        'Cache-Control: no-cache',
    ],
    CURLOPT_TIMEOUT        => 20,
]);
$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode >= 400) {
    Response::error('Could not verify payment with the gateway.', 502);
}

$data = json_decode((string) $response, true);
$status = is_array($data) ? (string) ($data['data']['status'] ?? '') : '';
$metaOrder = (int) ($data['data']['metadata']['order_id'] ?? 0);

if ($status !== 'success') {
    Response::error('Payment has not been completed yet.', 409, [
        'code'           => 'payment_pending',
        'payment_status' => $status !== '' ? $status : 'pending',
    ]);
}

if ($metaOrder > 0 && $metaOrder !== $orderId) {
    Response::error('Payment reference does not match this order.', 422);
}

$channel = isset($data['data']['channel']) ? (string) $data['data']['channel'] : null;
OrderService::markPaid($pdo, $orderId, $reference, $channel, is_array($data['data'] ?? null) ? $data['data'] : []);

Response::success([
    'order_id'       => $orderId,
    'payment_status' => 'paid',
    'message'        => 'Payment confirmed.',
]);
