<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();

$status = trim((string) ($_GET['status'] ?? ''));
$search = trim((string) ($_GET['search'] ?? ''));

$sql = 'SELECT o.id, o.status, o.payment_status, o.subtotal, o.total, o.created_at,
               u.id AS user_id, u.name AS customer_name, u.email AS customer_email
        FROM orders o
        INNER JOIN users u ON u.id = o.user_id
        WHERE 1=1';
$params = [];

$allowed = ['placed', 'payment_confirmed', 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
if ($status !== '' && in_array($status, $allowed, true)) {
    $sql .= ' AND o.status = ?';
    $params[] = $status;
}

if ($search !== '') {
    $sql .= ' AND (CAST(o.id AS CHAR) LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$sql .= ' ORDER BY o.created_at DESC LIMIT 200';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$orders = $stmt->fetchAll();

$result = [];
if ($orders !== []) {
    $ids = array_map(static fn ($o) => (int) $o['id'], $orders);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $itemsStmt = $pdo->prepare(
        "SELECT oi.order_id, oi.quantity, oi.is_preorder, p.name, p.images
         FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id IN ({$placeholders})
         ORDER BY oi.id ASC"
    );
    $itemsStmt->execute($ids);

    $byOrder = [];
    foreach ($itemsStmt->fetchAll() as $it) {
        $oid = (int) $it['order_id'];
        $byOrder[$oid] ??= ['count' => 0, 'thumbs' => [], 'preorder' => false];
        $byOrder[$oid]['count'] += (int) $it['quantity'];
        $byOrder[$oid]['preorder'] = $byOrder[$oid]['preorder'] || (int) $it['is_preorder'] === 1;
        if (count($byOrder[$oid]['thumbs']) < 4) {
            $imgs = json_decode((string) ($it['images'] ?? ''), true);
            $byOrder[$oid]['thumbs'][] = is_array($imgs) && isset($imgs[0]) ? $imgs[0] : null;
        }
    }

    foreach ($orders as $o) {
        $oid = (int) $o['id'];
        $meta = $byOrder[$oid] ?? ['count' => 0, 'thumbs' => [], 'preorder' => false];
        $result[] = [
            'id'             => $oid,
            'status'         => $o['status'],
            'payment_status' => $o['payment_status'],
            'subtotal'       => (float) $o['subtotal'],
            'total'          => (float) $o['total'],
            'currency'       => 'GHS',
            'created_at'     => $o['created_at'],
            'item_count'     => $meta['count'],
            'has_preorder'   => $meta['preorder'],
            'thumbnails'     => $meta['thumbs'],
            'customer'       => [
                'id'    => (int) $o['user_id'],
                'name'  => $o['customer_name'],
                'email' => $o['customer_email'],
            ],
        ];
    }
}

Response::success(['data' => $result]);
