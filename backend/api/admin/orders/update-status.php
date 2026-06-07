<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MarketplaceSplitService;
use App\Helpers\NotificationService;
use App\Helpers\OrderService;
use App\Helpers\PaymentSettings;
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

$body = Response::body();
$status = trim((string) ($body['status'] ?? ''));
$note = trim((string) ($body['note'] ?? ''));

$allowed = [
    'placed', 'payment_confirmed', 'pending', 'processing', 'received_at_hub',
    'shipped', 'out_for_delivery', 'delivered',
    'sent_to_station', 'ready_for_pickup', 'collected', 'cancelled',
];
if (!in_array($status, $allowed, true)) {
    Response::error('Invalid order status.', 422);
}

if ($status === 'cancelled') {
    OrderService::cancelByAdmin($pdo, $orderId, (int) $user['id'], $note);
    Response::success(['message' => 'Order cancelled.', 'id' => $orderId, 'status' => 'cancelled']);
}

$stmt = $pdo->prepare('SELECT id, payment_status, status, payment_method FROM orders WHERE id = ?');
$stmt->execute([$orderId]);
$order = $stmt->fetch();
if ($order === false) {
    Response::error('Order not found.', 404);
}

if (($order['status'] ?? '') === 'cancelled') {
    Response::error('Cancelled orders cannot be updated here. Use Revive for customer-cancelled orders.', 422);
}

$fulfillmentStatuses = [
    'processing', 'received_at_hub', 'shipped', 'out_for_delivery', 'delivered',
    'sent_to_station', 'ready_for_pickup', 'collected',
];
$settings = PaymentSettings::get($pdo);
$isPod = ($order['payment_method'] ?? '') === 'pod';
if (
    $settings['pay_before_delivery']
    && !$isPod
    && in_array($status, $fulfillmentStatuses, true)
    && ($order['payment_status'] ?? '') !== 'paid'
) {
    Response::error('This order must be paid before it can be prepared or shipped.', 422, [
        'code' => 'payment_required',
    ]);
}

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$status, $orderId]);
    $pdo->prepare(
        'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
    )->execute([$orderId, $status, $note !== '' ? $note : null, (int) $user['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

NotificationService::notifyOrderStatus($pdo, $orderId, $status, $note !== '' ? $note : null);

if (in_array($status, ['collected', 'delivered'], true)) {
    MarketplaceSplitService::releaseOnOrderComplete($pdo, $orderId);
}

Response::success(['message' => 'Order status updated.', 'id' => $orderId, 'status' => $status]);
