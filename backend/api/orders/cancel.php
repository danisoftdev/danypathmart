<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order not found.', 404);
}

$body = Response::body();
$reason = trim((string) ($body['reason'] ?? ''));

OrderService::cancelByCustomer($pdo, $orderId, (int) $user['id'], $reason !== '' ? $reason : null);

Response::success(['message' => 'Order cancelled.', 'id' => $orderId]);
