<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$orderId = (int) ($body['order_id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order id is required.', 422);
}

$amount = isset($body['amount']) ? round((float) $body['amount'], 2) : null;

$result = OrderService::payWithWallet($pdo, $orderId, (int) $user['id'], $amount);

Response::success([
    'order_id'    => $orderId,
    'wallet_paid' => $result['wallet_paid'],
    'amount_due'  => $result['amount_due'],
    'paid'        => $result['paid'],
    'balance'     => $result['balance'],
]);
