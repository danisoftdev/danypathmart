<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\OrderService;
use App\Helpers\Response;
use App\Helpers\WalletService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();
$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order not found.', 404);
}

$stmt = $pdo->prepare(
    'SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o INNER JOIN users u ON u.id = o.user_id
     WHERE o.id = ?'
);
$stmt->execute([$orderId]);
$order = $stmt->fetch();
if ($order === false) {
    Response::error('Order not found.', 404);
}

$itemsStmt = $pdo->prepare(
    'SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.is_preorder, oi.estimated_arrival,
            oi.recipient_name, oi.size_label,
            p.name, p.slug, p.images
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC'
);
$itemsStmt->execute([$orderId]);

$items = array_map(static function (array $r): array {
    $decoded = json_decode((string) ($r['images'] ?? ''), true);
    $images = is_array($decoded) ? $decoded : [];

    return [
        'id'                => (int) $r['id'],
        'product_id'        => $r['product_id'] !== null ? (int) $r['product_id'] : null,
        'name'              => $r['name'] ?? 'Removed product',
        'slug'              => $r['slug'],
        'image'             => $images[0] ?? null,
        'quantity'          => (int) $r['quantity'],
        'unit_price'        => (float) $r['unit_price'],
        'line_total'        => round((float) $r['unit_price'] * (int) $r['quantity'], 2),
        'is_preorder'       => (int) $r['is_preorder'] === 1,
        'estimated_arrival' => $r['estimated_arrival'],
        'recipient_name'    => $r['recipient_name'] ?? null,
        'size_label'        => $r['size_label'] ?? null,
    ];
}, $itemsStmt->fetchAll());

$trackStmt = $pdo->prepare(
    'SELECT status, note, created_at FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC, id ASC'
);
$trackStmt->execute([$orderId]);
$tracking = array_map(static fn (array $t): array => [
    'status'     => $t['status'],
    'note'       => $t['note'],
    'created_at' => $t['created_at'],
], $trackStmt->fetchAll());

$address = null;
if ($order['address_id'] !== null) {
    $aStmt = $pdo->prepare(
        'SELECT recipient_name, phone, region, city, street, landmark FROM addresses WHERE id = ?'
    );
    $aStmt->execute([(int) $order['address_id']]);
    $a = $aStmt->fetch();
    if ($a !== false) {
        $address = $a;
    }
}

Response::success([
    'order' => [
        'id'                     => (int) $order['id'],
        'status'                 => $order['status'],
        'payment_status'         => $order['payment_status'],
        'cancelled_by'           => $order['cancelled_by'] ?? null,
        'cancel_reason'          => $order['cancel_reason'] ?? null,
        'can_revive'             => ($order['status'] ?? '') === 'cancelled'
            && ($order['cancelled_by'] ?? '') === 'customer',
        'subtotal'               => (float) $order['subtotal'],
        'intl_shipping_cost'     => (float) $order['intl_shipping_cost'],
        'local_delivery_cost'    => (float) $order['local_delivery_cost'],
        'local_delivery_percent' => (float) $order['local_delivery_percent'],
        'total'                  => (float) $order['total'],
        'currency'               => 'GHS',
        'payment_ref'            => $order['payment_ref'],
        'payment_method'         => $order['payment_method'] ?? null,
        'wallet_paid'            => OrderService::walletPaid($order),
        'amount_due'             => OrderService::amountDue($order),
        'bank_transfer_ref'      => $order['bank_transfer_ref'] ?? null,
        'bank_transfer_submitted_at' => $order['bank_transfer_submitted_at'] ?? null,
        'can_confirm_bank_transfer' => ($order['payment_method'] ?? '') === 'bank_transfer'
            && ($order['payment_status'] ?? '') !== 'paid'
            && !empty($order['bank_transfer_ref']),
        'notes'                  => $order['notes'],
        'order_type'             => $order['order_type'] ?? 'retail',
        'organization_name'      => $order['organization_name'] ?? null,
        'discount_amount'        => (float) ($order['discount_amount'] ?? 0),
        'discount_label'         => $order['discount_label'] ?? null,
        'created_at'             => $order['created_at'],
        'address'                => $address,
        'pickup_station'         => OrderService::pickupStationFromOrder($order),
        'is_pickup'              => OrderService::isPickupOrder($order),
        'items'                  => $items,
        'tracking'               => $tracking,
        'has_preorder'           => array_reduce($items, static fn ($c, $i) => $c || $i['is_preorder'], false),
        'customer'               => [
            'id'    => (int) $order['user_id'],
            'name'  => $order['customer_name'],
            'email' => $order['customer_email'],
        ],
        'wallet_refunded_total'  => WalletService::refundedTotalForOrder($pdo, $orderId),
        'wallet_refunds'         => OrderService::walletRefundsForOrder($pdo, $orderId),
    ],
]);
