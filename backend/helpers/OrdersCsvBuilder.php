<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class OrdersCsvBuilder
{
    /** @var list<string> */
    public const COLUMNS = [
        'order_id',
        'created_at',
        'customer_name',
        'customer_email',
        'organization_name',
        'order_type',
        'status',
        'payment_status',
        'payment_method',
        'subtotal',
        'intl_shipping',
        'local_delivery',
        'discount',
        'total',
        'currency',
        'item_qty',
    ];

    /**
     * @return array{rows: list<array<string, scalar|null>>, has_discount: bool}
     */
    public static function fetch(PDO $pdo, array $filters = []): array
    {
        $status = trim((string) ($filters['status'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));
        $since = trim((string) ($filters['since'] ?? ''));
        $limit = isset($filters['limit']) ? max(1, min(10000, (int) $filters['limit'])) : 5000;

        $hasDiscount = true;
        $sql = 'SELECT o.id, o.status, o.payment_status, o.payment_method, o.order_type, o.organization_name,
                       o.subtotal, o.intl_shipping_cost, o.local_delivery_cost, o.discount_amount, o.total,
                       o.created_at, u.name AS customer_name, u.email AS customer_email
                FROM orders o
                INNER JOIN users u ON u.id = o.user_id
                WHERE 1=1';
        try {
            $pdo->query('SELECT discount_amount FROM orders LIMIT 1');
        } catch (\Throwable) {
            $hasDiscount = false;
            $sql = 'SELECT o.id, o.status, o.payment_status, o.payment_method, o.order_type, o.organization_name,
                           o.subtotal, o.intl_shipping_cost, o.local_delivery_cost, o.total,
                           o.created_at, u.name AS customer_name, u.email AS customer_email
                    FROM orders o
                    INNER JOIN users u ON u.id = o.user_id
                    WHERE 1=1';
        }

        $params = [];
        $allowed = ['placed', 'payment_confirmed', 'pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
        if ($status !== '' && in_array($status, $allowed, true)) {
            $sql .= ' AND o.status = ?';
            $params[] = $status;
        }

        if ($search !== '') {
            $sql .= ' AND (CAST(o.id AS CHAR) LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.organization_name LIKE ?)';
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like, $like);
        }

        if ($since !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $since) === 1) {
            $sql .= ' AND o.created_at >= ?';
            $params[] = $since . ' 00:00:00';
        }

        $sql .= ' ORDER BY o.created_at DESC LIMIT ' . $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        $itemCounts = [];
        if ($orders !== []) {
            $ids = array_map(static fn ($o) => (int) $o['id'], $orders);
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $countStmt = $pdo->prepare(
                "SELECT order_id, SUM(quantity) AS qty FROM order_items WHERE order_id IN ({$placeholders}) GROUP BY order_id"
            );
            $countStmt->execute($ids);
            foreach ($countStmt->fetchAll() as $row) {
                $itemCounts[(int) $row['order_id']] = (int) $row['qty'];
            }
        }

        $rows = [];
        foreach ($orders as $o) {
            $oid = (int) $o['id'];
            $rows[] = [
                'order_id'           => $oid,
                'created_at'         => $o['created_at'],
                'customer_name'      => $o['customer_name'],
                'customer_email'     => $o['customer_email'],
                'organization_name'  => $o['organization_name'] ?? '',
                'order_type'         => $o['order_type'] ?? 'retail',
                'status'             => $o['status'],
                'payment_status'     => $o['payment_status'],
                'payment_method'     => $o['payment_method'] ?? '',
                'subtotal'           => number_format((float) $o['subtotal'], 2, '.', ''),
                'intl_shipping'      => number_format((float) $o['intl_shipping_cost'], 2, '.', ''),
                'local_delivery'     => number_format((float) $o['local_delivery_cost'], 2, '.', ''),
                'discount'           => $hasDiscount
                    ? number_format((float) ($o['discount_amount'] ?? 0), 2, '.', '')
                    : '0.00',
                'total'              => number_format((float) $o['total'], 2, '.', ''),
                'currency'           => 'GHS',
                'item_qty'           => $itemCounts[$oid] ?? 0,
            ];
        }

        return ['rows' => $rows, 'has_discount' => $hasDiscount];
    }
}
