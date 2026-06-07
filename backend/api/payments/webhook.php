<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;

/*
 * Paystack webhook. Paystack signs the raw request body with HMAC-SHA512 using
 * your secret key and sends it as the X-Paystack-Signature header. (The Day 3B
 * brief said sha256, but Paystack's documented algorithm is HMAC-SHA512, which
 * is what we verify here.)
 */
$raw = file_get_contents('php://input');
if ($raw === false) {
    $raw = '';
}

$secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
$signature = (string) ($_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '');

if ($secret === '' || $signature === '') {
    Response::error('Unauthorized webhook.', 401);
}

$expected = hash_hmac('sha512', $raw, $secret);
if (!hash_equals($expected, $signature)) {
    Response::error('Invalid signature.', 401);
}

$event = json_decode($raw, true);
if (!is_array($event)) {
    Response::json(['success' => true], 200); // ack malformed body so Paystack stops retrying
}

if (($event['event'] ?? '') !== 'charge.success') {
    Response::json(['success' => true], 200);
}

$data = $event['data'] ?? [];
$reference = (string) ($data['reference'] ?? '');
$channel = isset($data['channel']) ? (string) $data['channel'] : null;
$orderId = (int) ($data['metadata']['order_id'] ?? 0);

$pdo = Database::pdo();

$meta = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
$billingType = (string) ($meta['billing_type'] ?? '');

if ($reference !== '' && in_array($billingType, ['shop_registration', 'shop_renewal'], true)) {
    ShopBillingService::confirmFromWebhook($pdo, $reference, $data);
    Response::json(['success' => true], 200);
}

if ($orderId <= 0 && $reference !== '') {
    $stmt = $pdo->prepare('SELECT id FROM orders WHERE payment_ref = ?');
    $stmt->execute([$reference]);
    $orderId = (int) ($stmt->fetchColumn() ?: 0);
}

if ($orderId > 0 && $reference !== '') {
    OrderService::markPaid($pdo, $orderId, $reference, $channel, $data);
}

Response::json(['success' => true], 200);
