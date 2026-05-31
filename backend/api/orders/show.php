<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$orderId = (int) ($_GET['id'] ?? 0);
if ($orderId <= 0) {
    Response::error('Order not found.', 404);
}

$stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
$stmt->execute([$orderId, $user['id']]);
$order = $stmt->fetch();
if ($order === false) {
    Response::error('Order not found.', 404);
}

$itemsStmt = $pdo->prepare(
    'SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.is_preorder, oi.estimated_arrival,
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
    ];
}, $itemsStmt->fetchAll());

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
        'subtotal'               => (float) $order['subtotal'],
        'intl_shipping_cost'     => (float) $order['intl_shipping_cost'],
        'local_delivery_cost'    => (float) $order['local_delivery_cost'],
        'local_delivery_percent' => (float) $order['local_delivery_percent'],
        'total'                  => (float) $order['total'],
        'currency'               => 'GHS',
        'payment_ref'            => $order['payment_ref'],
        'notes'                  => $order['notes'],
        'created_at'             => $order['created_at'],
        'address'                => $address,
        'items'                  => $items,
        'has_preorder'           => array_reduce($items, static fn ($c, $i) => $c || $i['is_preorder'], false),
    ],
]);
