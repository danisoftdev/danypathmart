<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/**
 * Aggregates sales revenue, freight/CBM costs, product cost and on-hand inventory
 * for the admin financial & inventory reports.
 */
final class FinancialReport
{
    /**
     * @return array<string,mixed>
     */
    public static function build(PDO $pdo): array
    {
        $settings = ShippingService::settings($pdo);
        $usdRate = $settings['usd_to_ghs_rate'];

        $rev = $pdo->query(
            "SELECT
                COALESCE(SUM(subtotal), 0) AS gross_sales,
                COALESCE(SUM(intl_shipping_cost), 0) AS intl_shipping_collected,
                COALESCE(SUM(local_delivery_cost), 0) AS local_delivery_collected,
                COALESCE(SUM(total), 0) AS total_collected,
                COUNT(*) AS paid_orders
             FROM orders
             WHERE payment_status = 'paid'"
        )->fetch();

        $itemsStmt = $pdo->query(
            'SELECT oi.quantity, oi.unit_cost, oi.unit_cbm_cost, oi.is_preorder,
                    p.cost_price, p.cbm_length, p.cbm_width, p.cbm_height, p.cbm_weight,
                    p.intl_freight_rate, p.is_preorder AS product_is_preorder
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE o.payment_status = \'paid\''
        );

        $productCost = 0.0;
        $cbmCost = 0.0;
        $unitsSold = 0;

        foreach ($itemsStmt->fetchAll() as $row) {
            $qty = (int) $row['quantity'];
            $unitsSold += $qty;

            $unitCost = (float) $row['unit_cost'];
            if ($unitCost <= 0 && $row['cost_price'] !== null) {
                $unitCost = (float) $row['cost_price'];
            }
            $productCost += $unitCost * $qty;

            $unitCbm = (float) $row['unit_cbm_cost'];
            if ($unitCbm <= 0 && (int) ($row['is_preorder'] ?? 0) === 1) {
                $unitCbm = ShippingService::intlFreightPerUnit([
                    'is_preorder'        => 1,
                    'cbm_length'         => $row['cbm_length'],
                    'cbm_width'          => $row['cbm_width'],
                    'cbm_height'         => $row['cbm_height'],
                    'cbm_weight'         => $row['cbm_weight'],
                    'intl_freight_rate'  => $row['intl_freight_rate'],
                ], $usdRate);
            }
            $cbmCost += $unitCbm * $qty;
        }

        $grossSales = round((float) $rev['gross_sales'], 2);
        $intlShipping = round((float) $rev['intl_shipping_collected'], 2);
        $localDelivery = round((float) $rev['local_delivery_collected'], 2);
        $shippingCollected = round($intlShipping + $localDelivery, 2);
        $totalCollected = round((float) $rev['total_collected'], 2);
        $productCost = round($productCost, 2);
        $cbmCost = round($cbmCost, 2);
        $totalDeductions = round($productCost + $cbmCost, 2);
        $productInterest = round($grossSales - $productCost, 2);
        $netInterest = round($totalCollected - $totalDeductions, 2);

        $inv = $pdo->query(
            "SELECT
                COALESCE(SUM(stock_qty), 0) AS units_on_hand,
                COALESCE(SUM(stock_qty * cost_price), 0) AS inventory_cost_value,
                COALESCE(SUM(stock_qty * price), 0) AS inventory_retail_value,
                COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_skus,
                COUNT(CASE WHEN status = 'active' AND stock_qty <= 5 AND stock_qty > 0 THEN 1 END) AS low_stock_skus,
                COUNT(CASE WHEN status = 'active' AND stock_qty = 0 THEN 1 END) AS out_of_stock_skus
             FROM products
             WHERE shop_id IS NULL OR shop_id = 0"
        )->fetch();

        $inventoryCost = round((float) $inv['inventory_cost_value'], 2);
        $inventoryRetail = round((float) $inv['inventory_retail_value'], 2);

        $recent = $pdo->query(
            "SELECT id, subtotal, intl_shipping_cost, local_delivery_cost, total, created_at
             FROM orders
             WHERE payment_status = 'paid'
             ORDER BY created_at DESC
             LIMIT 8"
        )->fetchAll();

        $recentSales = array_map(static function (array $row): array {
            return [
                'id'                     => (int) $row['id'],
                'subtotal'               => round((float) $row['subtotal'], 2),
                'intl_shipping_cost'     => round((float) $row['intl_shipping_cost'], 2),
                'local_delivery_cost'    => round((float) $row['local_delivery_cost'], 2),
                'total'                  => round((float) $row['total'], 2),
                'created_at'             => $row['created_at'],
            ];
        }, $recent);

        return [
            'currency'              => 'GHS',
            'paid_orders'           => (int) $rev['paid_orders'],
            'units_sold'            => $unitsSold,
            'revenue'               => [
                'gross_sales'              => $grossSales,
                'intl_shipping_collected'  => $intlShipping,
                'local_delivery_collected' => $localDelivery,
                'shipping_collected'       => $shippingCollected,
                'total_collected'          => $totalCollected,
            ],
            'deductions'            => [
                'product_cost'   => $productCost,
                'cbm_cost'       => $cbmCost,
                'total'          => $totalDeductions,
            ],
            'interest'              => [
                'product_interest' => $productInterest,
                'net_interest'     => $netInterest,
            ],
            'inventory'             => [
                'units_on_hand'          => (int) $inv['units_on_hand'],
                'active_skus'            => (int) $inv['active_skus'],
                'low_stock_skus'         => (int) $inv['low_stock_skus'],
                'out_of_stock_skus'      => (int) $inv['out_of_stock_skus'],
                'cost_value'             => $inventoryCost,
                'retail_value'           => $inventoryRetail,
                'potential_interest'     => round($inventoryRetail - $inventoryCost, 2),
            ],
            'recent_sales'          => $recentSales,
        ];
    }
}
