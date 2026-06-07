<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('edit_orders');

$pdo = Database::pdo();
$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order not found.', 404);
}

OrderService::confirmBankTransfer($pdo, $orderId, (int) $user['id']);

Response::success([
    'message'         => 'Bank transfer confirmed. Order is now paid.',
    'id'              => $orderId,
    'payment_status'  => 'paid',
]);
