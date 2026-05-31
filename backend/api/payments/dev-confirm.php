<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

/*
 * Development-only: simulates a successful Paystack charge so the full
 * order -> payment -> confirmation flow can be exercised locally without a
 * public webhook URL or live keys. Disabled in production.
 */
if (Env::isProduction()) {
    Response::error('Not available.', 404);
}

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

$reference = $order['payment_ref'] !== null && $order['payment_ref'] !== ''
    ? (string) $order['payment_ref']
    : 'DEV-' . bin2hex(random_bytes(8));

OrderService::markPaid($pdo, $orderId, $reference, 'dev', ['simulated' => true]);

Response::success([
    'order_id'       => $orderId,
    'payment_status' => 'paid',
    'message'        => 'Payment simulated (development).',
]);
