<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** CSV rows for marketplace shop sales (orders summary or line items). */
final class ShopSalesCsvBuilder
{
    /** @var list<string> */
    public const ORDER_COLUMNS = [
        'order_id',
        'order_date',
        'customer_name',
        'customer_email',
        'customer_phone',
        'delivery_address',
        'payment_status',
        'fulfillment_status',
        'shop_subtotal',
        'commission_rate_pct',
        'commission_amount',
        'net_earnings',
        'earnings_status',
        'earnings_released_at',
    ];

    /** @var list<string> */
    public const ITEM_COLUMNS = [
        'order_id',
        'order_date',
        'product_name',
        'quantity',
        'unit_price',
        'line_total',
        'customer_name',
        'payment_status',
        'fulfillment_status',
    ];

    /**
     * @return array{rows: list<array<string, scalar|null>>, columns: list<string>}
     */
    public static function fetch(PDO $pdo, int $shopId, array $filters = []): array
    {
        $view = strtolower(trim((string) ($filters['view'] ?? 'orders')));
        if ($view === 'items') {
            return ['rows' => self::fetchItemRows($pdo, $shopId, $filters), 'columns' => self::ITEM_COLUMNS];
        }

        return ['rows' => self::fetchOrderRows($pdo, $shopId, $filters), 'columns' => self::ORDER_COLUMNS];
    }

    /**
     * @return list<array<string, scalar|null>>
     */
    private static function fetchOrderRows(PDO $pdo, int $shopId, array $filters): array
    {
        [$sql, $params] = self::fulfillmentBaseSql($shopId, $filters);
        $sql .= ' ORDER BY o.created_at DESC, f.id DESC LIMIT ' . self::limit($filters);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $rows = [];
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                'order_id'              => (int) $r['order_id'],
                'order_date'            => $r['order_created_at'],
                'customer_name'         => $r['customer_name'] ?? '',
                'customer_email'        => $r['customer_email'] ?? '',
                'customer_phone'        => $r['customer_phone'] ?? '',
                'delivery_address'      => self::formatAddress($r),
                'payment_status'        => $r['payment_status'] ?? '',
                'fulfillment_status'    => $r['fulfillment_status'] ?? '',
                'shop_subtotal'         => number_format((float) ($r['shop_subtotal'] ?? 0), 2, '.', ''),
                'commission_rate_pct'   => $r['commission_rate'] !== null
                    ? number_format((float) $r['commission_rate'], 2, '.', '')
                    : '',
                'commission_amount'     => $r['commission_amount'] !== null
                    ? number_format((float) $r['commission_amount'], 2, '.', '')
                    : '',
                'net_earnings'          => $r['net_amount'] !== null
                    ? number_format((float) $r['net_amount'], 2, '.', '')
                    : '',
                'earnings_status'       => $r['earnings_status'] ?? '',
                'earnings_released_at'  => $r['released_at'] ?? '',
            ];
        }

        return $rows;
    }

    /**
     * @return list<array<string, scalar|null>>
     */
    private static function fetchItemRows(PDO $pdo, int $shopId, array $filters): array
    {
        $since = trim((string) ($filters['since'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));

        $sql = 'SELECT o.id AS order_id, o.created_at AS order_created_at, o.payment_status,
                       f.status AS fulfillment_status, u.name AS customer_name,
                       p.name AS product_name, oi.quantity, oi.unit_price
                FROM order_items oi
                INNER JOIN products p ON p.id = oi.product_id AND p.shop_id = ?
                INNER JOIN orders o ON o.id = oi.order_id
                INNER JOIN users u ON u.id = o.user_id
                LEFT JOIN shop_order_fulfillments f ON f.order_id = o.id AND f.shop_id = ?
                WHERE 1=1';
        $params = [$shopId, $shopId];

        if ($since !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $since) === 1) {
            $sql .= ' AND o.created_at >= ?';
            $params[] = $since . ' 00:00:00';
        }

        $allowedFulfillment = ['awaiting_payment', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        if ($status !== '' && in_array($status, $allowedFulfillment, true)) {
            $sql .= ' AND f.status = ?';
            $params[] = $status;
        }

        $sql .= ' ORDER BY o.created_at DESC, oi.id ASC LIMIT ' . self::limit($filters);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $rows = [];
        foreach ($stmt->fetchAll() as $r) {
            $qty = (int) $r['quantity'];
            $unit = (float) $r['unit_price'];
            $rows[] = [
                'order_id'           => (int) $r['order_id'],
                'order_date'         => $r['order_created_at'],
                'product_name'       => $r['product_name'] ?? '',
                'quantity'           => $qty,
                'unit_price'         => number_format($unit, 2, '.', ''),
                'line_total'         => number_format($unit * $qty, 2, '.', ''),
                'customer_name'      => $r['customer_name'] ?? '',
                'payment_status'     => $r['payment_status'] ?? '',
                'fulfillment_status' => $r['fulfillment_status'] ?? '',
            ];
        }

        return $rows;
    }

    /** @return array{0: string, 1: list<mixed>} */
    private static function fulfillmentBaseSql(int $shopId, array $filters): array
    {
        $since = trim((string) ($filters['since'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));

        $sql = 'SELECT f.order_id, f.status AS fulfillment_status, f.subtotal AS shop_subtotal,
                       o.created_at AS order_created_at, o.payment_status,
                       u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                       a.recipient_name AS address_recipient, a.street, a.landmark, a.city, a.region, a.phone AS address_phone,
                       e.commission_rate, e.commission_amount, e.net_amount, e.status AS earnings_status, e.released_at
                FROM shop_order_fulfillments f
                INNER JOIN orders o ON o.id = f.order_id
                INNER JOIN users u ON u.id = o.user_id
                LEFT JOIN addresses a ON a.id = o.address_id
                LEFT JOIN shop_order_earnings e ON e.order_id = f.order_id AND e.shop_id = f.shop_id
                WHERE f.shop_id = ?';
        $params = [$shopId];

        if ($since !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $since) === 1) {
            $sql .= ' AND o.created_at >= ?';
            $params[] = $since . ' 00:00:00';
        }

        $allowedFulfillment = ['awaiting_payment', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
        if ($status !== '' && in_array($status, $allowedFulfillment, true)) {
            $sql .= ' AND f.status = ?';
            $params[] = $status;
        }

        return [$sql, $params];
    }

    /** @param array<string,mixed> $row */
    private static function formatAddress(array $row): string
    {
        $parts = array_filter([
            $row['address_recipient'] ?? null,
            $row['street'] ?? null,
            $row['landmark'] ?? null,
            $row['city'] ?? null,
            $row['region'] ?? null,
        ], static fn ($v) => $v !== null && trim((string) $v) !== '');

        return $parts !== [] ? implode(', ', $parts) : '';
    }

    private static function limit(array $filters): int
    {
        return isset($filters['limit']) ? max(1, min(10000, (int) $filters['limit'])) : 5000;
    }
}
