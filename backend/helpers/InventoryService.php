<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Stock commit on payment + units sold counters. */
final class InventoryService
{
    public static function shouldCommitOnOrderCreate(string $paymentMethod): bool
    {
        return in_array($paymentMethod, ['pod'], true);
    }

    public static function commitOrderInventory(PDO $pdo, int $orderId): void
    {
        $stmt = $pdo->prepare('SELECT inventory_committed, payment_method FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false || (int) ($order['inventory_committed'] ?? 0) === 1) {
            return;
        }

        $items = $pdo->prepare(
            'SELECT oi.product_id, oi.quantity, oi.is_preorder
             FROM order_items oi
             WHERE oi.order_id = ? AND oi.product_id IS NOT NULL'
        );
        $items->execute([$orderId]);

        foreach ($items->fetchAll() as $row) {
            if ((int) ($row['is_preorder'] ?? 0) === 1) {
                continue;
            }
            $pid = (int) $row['product_id'];
            $qty = (int) $row['quantity'];
            if ($pid <= 0 || $qty <= 0) {
                continue;
            }
            $pdo->prepare(
                'UPDATE products SET stock_qty = GREATEST(0, stock_qty - ?), units_sold = units_sold + ? WHERE id = ?'
            )->execute([$qty, $qty, $pid]);
        }

        $pdo->prepare('UPDATE orders SET inventory_committed = 1 WHERE id = ?')->execute([$orderId]);
    }

    public static function restoreOrderInventory(PDO $pdo, int $orderId): void
    {
        $stmt = $pdo->prepare('SELECT inventory_committed FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false || (int) ($order['inventory_committed'] ?? 0) !== 1) {
            return;
        }

        $items = $pdo->prepare(
            'SELECT oi.product_id, oi.quantity, oi.is_preorder
             FROM order_items oi
             WHERE oi.order_id = ? AND oi.product_id IS NOT NULL'
        );
        $items->execute([$orderId]);

        foreach ($items->fetchAll() as $row) {
            if ((int) ($row['is_preorder'] ?? 0) === 1) {
                continue;
            }
            $pid = (int) $row['product_id'];
            $qty = (int) $row['quantity'];
            if ($pid <= 0 || $qty <= 0) {
                continue;
            }
            $pdo->prepare(
                'UPDATE products SET stock_qty = stock_qty + ?, units_sold = GREATEST(0, units_sold - ?) WHERE id = ?'
            )->execute([$qty, $qty, $pid]);
        }

        $pdo->prepare('UPDATE orders SET inventory_committed = 0 WHERE id = ?')->execute([$orderId]);
    }

    /** @return array{show_units_sold:bool,show_low_stock_exact:bool,stock_decrement_on_payment:bool} */
    public static function displaySettings(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT show_units_sold_badge, show_low_stock_exact, stock_decrement_on_payment
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return [
                'show_units_sold'            => true,
                'show_low_stock_exact'       => true,
                'stock_decrement_on_payment' => true,
            ];
        }

        if ($row === false) {
            return [
                'show_units_sold'            => true,
                'show_low_stock_exact'       => true,
                'stock_decrement_on_payment' => true,
            ];
        }

        return [
            'show_units_sold'            => (int) ($row['show_units_sold_badge'] ?? 1) === 1,
            'show_low_stock_exact'       => (int) ($row['show_low_stock_exact'] ?? 1) === 1,
            'stock_decrement_on_payment' => (int) ($row['stock_decrement_on_payment'] ?? 1) === 1,
        ];
    }

    public static function unitsSoldBand(int $units): ?string
    {
        if ($units <= 0) {
            return null;
        }
        if ($units >= 100) {
            return '100+ sold';
        }
        if ($units >= 50) {
            return '50+ sold';
        }
        if ($units >= 10) {
            return '10+ sold';
        }

        return $units . ' sold';
    }
}
