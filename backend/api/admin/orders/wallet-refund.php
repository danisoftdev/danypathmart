<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\WalletService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('edit_orders');

$pdo = Database::pdo();
$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order not found.', 404);
}

$body = Response::body();
$amount = (float) ($body['amount'] ?? 0);
$reason = trim((string) ($body['reason'] ?? ''));

$result = WalletService::refundOrderToWallet(
    $pdo,
    $orderId,
    $amount,
    $reason,
    (int) $admin['id']
);

Response::success([
    'message'        => 'Credited ' . number_format($result['credited'], 2) . ' GHS to customer wallet.',
    'credited'       => $result['credited'],
    'balance'        => $result['balance'],
    'transaction_id' => $result['transaction_id'],
]);
