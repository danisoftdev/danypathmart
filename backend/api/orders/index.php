<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$stmt = $pdo->prepare(
    'SELECT id, status, payment_status, subtotal, total, created_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
);
$stmt->execute([$user['id']]);
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
        ];
    }
}

Response::success(['data' => $result]);
