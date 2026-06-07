<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$stmt = $pdo->prepare(
    'SELECT DISTINCT o.id, o.status, o.payment_status, o.total, o.created_at,
            SUM(oi.quantity * oi.unit_price) AS shop_subtotal
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     INNER JOIN products p ON p.id = oi.product_id
     WHERE p.shop_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 100'
);
$stmt->execute([$ctx['shop_id']]);

Response::success(['data' => array_map(static fn (array $r): array => [
    'id'             => (int) $r['id'],
    'status'         => $r['status'],
    'payment_status' => $r['payment_status'],
    'total'          => (float) $r['total'],
    'shop_subtotal'  => round((float) $r['shop_subtotal'], 2),
    'created_at'     => $r['created_at'],
], $stmt->fetchAll())]);
