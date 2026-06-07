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
$reference = trim((string) ($body['reference'] ?? ''));

if ($orderId <= 0) {
    Response::error('Order id is required.', 422);
}

OrderService::submitBankTransfer($pdo, $orderId, (int) $user['id'], $reference);

Response::success([
    'order_id'  => $orderId,
    'reference' => $reference,
    'message'   => 'Transfer reference received. We will confirm your payment soon.',
]);
