<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/**
 * Server-authoritative cart pricing: subtotal, international (pre-order)
 * freight via CBM, and local delivery. The client only supplies product ids
 * and quantities; every price/weight value is read from the database so the
 * total can never be tampered with from the browser.
 */
final class ShippingService
{
    /** Volumetric (dimensional) weight divisor: 1 CBM = 167 kg. */
    private const VOLUMETRIC_FACTOR = 167.0;

    /**
     * @return array{local_delivery_percent:float,usd_to_ghs_rate:float}
     */
    public static function settings(PDO $pdo): array
    {
        $percent = $pdo->query(
            'SELECT local_delivery_base_percent FROM shipping_settings ORDER BY id DESC LIMIT 1'
        )->fetchColumn();

        $rate = $pdo->query(
            'SELECT usd_to_ghs_rate FROM company_settings ORDER BY id DESC LIMIT 1'
        )->fetchColumn();

        return [
            'local_delivery_percent' => $percent === false ? 0.0 : (float) $percent,
            'usd_to_ghs_rate'        => $rate === false ? 0.0 : (float) $rate,
        ];
    }

    /**
     * Price a cart and (optionally) enforce stock.
     *
     * @param array<int,array<string,mixed>> $items  [{product_id, quantity}, ...]
     * @return array{
     *   subtotal:float, intl_shipping_cost:float, local_delivery_cost:float,
     *   local_delivery_percent:float, total:float, currency:string,
     *   lines:array<int,array<string,mixed>>, errors:array<int,array<string,mixed>>
     * }
     */
    public static function quote(PDO $pdo, array $items, bool $requireStock = false): array
    {
        $qtyById = [];
        foreach ($items as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $qty = (int) ($item['quantity'] ?? 0);
            if ($pid <= 0 || $qty <= 0) {
                continue;
            }
            $qtyById[$pid] = ($qtyById[$pid] ?? 0) + $qty;
        }

        $set = self::settings($pdo);
        $errors = [];
        $lines = [];
        $subtotal = 0.0;
        $intl = 0.0;

        if ($qtyById !== []) {
            $ids = array_keys($qtyById);
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ({$placeholders})");
            $stmt->execute($ids);

            $found = [];
            foreach ($stmt->fetchAll() as $row) {
                $found[(int) $row['id']] = $row;
            }

            foreach ($qtyById as $pid => $qty) {
                if (!isset($found[$pid]) || $found[$pid]['status'] !== 'active') {
                    $errors[] = ['product_id' => $pid, 'error' => 'unavailable'];
                    continue;
                }

                $p = $found[$pid];
                $isPre = (int) $p['is_preorder'] === 1;

                if ($requireStock && !$isPre && (int) $p['stock_qty'] < $qty) {
                    $errors[] = [
                        'product_id' => $pid,
                        'name'       => $p['name'],
                        'error'      => 'out_of_stock',
                        'available'  => (int) $p['stock_qty'],
                    ];
                    continue;
                }

                $unit = (float) $p['price'];
                $subtotal += $unit * $qty;

                $eta = null;
                if ($isPre) {
                    $l  = (float) ($p['cbm_length'] ?? 0);
                    $w  = (float) ($p['cbm_width'] ?? 0);
                    $h  = (float) ($p['cbm_height'] ?? 0);
                    $wt = (float) ($p['cbm_weight'] ?? 0);
                    $fr = (float) ($p['intl_freight_rate'] ?? 0);

                    $cbm = ($l * $w * $h) / 1_000_000.0;
                    $chargeable = max($wt, $cbm * self::VOLUMETRIC_FACTOR);
                    $intl += $chargeable * $fr * $set['usd_to_ghs_rate'] * $qty;

                    if (!empty($p['estimated_arrival_days'])) {
                        $eta = date('Y-m-d', time() + ((int) $p['estimated_arrival_days']) * 86400);
                    }
                }

                $lines[] = [
                    'product'           => $p,
                    'quantity'          => $qty,
                    'unit_price'        => round($unit, 2),
                    'is_preorder'       => $isPre,
                    'estimated_arrival' => $eta,
                ];
            }
        }

        $subtotal = round($subtotal, 2);
        $intl = round($intl, 2);
        $local = round($subtotal * ($set['local_delivery_percent'] / 100.0), 2);

        return [
            'subtotal'               => $subtotal,
            'intl_shipping_cost'     => $intl,
            'local_delivery_cost'    => $local,
            'local_delivery_percent' => round($set['local_delivery_percent'], 2),
            'total'                  => round($subtotal + $intl + $local, 2),
            'currency'               => 'GHS',
            'lines'                  => $lines,
            'errors'                 => $errors,
        ];
    }
}
