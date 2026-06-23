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
     * International freight cost per unit (GHS) from CBM / weight and freight rate.
     *
     * @param array<string,mixed> $product
     */
    public static function intlFreightPerUnit(array $product, float $usdToGhs): float
    {
        if ((int) ($product['is_preorder'] ?? 0) !== 1) {
            return 0.0;
        }

        $l  = (float) ($product['cbm_length'] ?? 0);
        $w  = (float) ($product['cbm_width'] ?? 0);
        $h  = (float) ($product['cbm_height'] ?? 0);
        $wt = (float) ($product['cbm_weight'] ?? 0);
        $fr = (float) ($product['intl_freight_rate'] ?? 0);

        if ($fr <= 0 || ($l <= 0 && $w <= 0 && $h <= 0 && $wt <= 0)) {
            return 0.0;
        }

        $cbm = ($l * $w * $h) / 1_000_000.0;
        $chargeable = max($wt, $cbm * self::VOLUMETRIC_FACTOR);

        return round($chargeable * $fr * $usdToGhs, 2);
    }

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
    public static function quote(PDO $pdo, array $items, bool $requireStock = false, ?string $region = null, ?int $pickupStationId = null, ?string $shopFulfillmentMode = null): array
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
                $shopId = isset($p['shop_id']) && $p['shop_id'] !== null && (int) $p['shop_id'] > 0
                    ? (int) $p['shop_id']
                    : null;
                $isPre = (int) $p['is_preorder'] === 1;

                if ($shopId !== null && $isPre) {
                    $errors[] = [
                        'product_id' => $pid,
                        'name'       => $p['name'],
                        'error'      => 'shop_preorder_not_allowed',
                    ];
                    continue;
                }

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
                if ($isPre && $shopId === null) {
                    $intl += self::intlFreightPerUnit($p, $set['usd_to_ghs_rate']) * $qty;

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
                    'shop_id'           => $shopId,
                    'fulfillment'       => $shopId !== null ? 'shop' : 'dpm',
                ];
            }
        }

        $subtotal = round($subtotal, 2);
        $intl = round($intl, 2);

        $dpmSubtotal = 0.0;
        $shopSubtotal = 0.0;
        foreach ($lines as $line) {
            $lineTotal = (float) $line['unit_price'] * (int) $line['quantity'];
            if (($line['fulfillment'] ?? 'dpm') === 'shop') {
                $shopSubtotal += $lineTotal;
            } else {
                $dpmSubtotal += $lineTotal;
            }
        }
        $dpmSubtotal = round($dpmSubtotal, 2);
        $shopSubtotal = round($shopSubtotal, 2);
        $hasShopItems = $shopSubtotal > 0;
        $hasDpmItems = $dpmSubtotal > 0;

        $deliveryMode = 'address';
        $localPercent = round($set['local_delivery_percent'], 2);
        if ($pickupStationId !== null && $pickupStationId > 0 && $hasDpmItems && !$hasShopItems) {
            $station = PickupStationService::findActive($pdo, $pickupStationId);
            if ($station !== null) {
                $local = round((float) $station['pickup_handling_fee'], 2);
                $localPercent = 0.0;
                $deliveryMode = 'pickup';
                $region = (string) $station['region'];
            } else {
                $local = round($dpmSubtotal * ($set['local_delivery_percent'] / 100.0), 2);
            }
        } else {
            $local = round($dpmSubtotal * ($set['local_delivery_percent'] / 100.0), 2);
        }

        $preorderCount = 0;
        $chargeableKg = 0.0;
        foreach ($lines as $line) {
            if (!$line['is_preorder'] || ($line['fulfillment'] ?? 'dpm') === 'shop') {
                continue;
            }
            $preorderCount += (int) $line['quantity'];
            $p = $line['product'];
            $l = (float) ($p['cbm_length'] ?? 0);
            $w = (float) ($p['cbm_width'] ?? 0);
            $h = (float) ($p['cbm_height'] ?? 0);
            $wt = (float) ($p['cbm_weight'] ?? 0);
            $cbm = ($l * $w * $h) / 1_000_000.0;
            $chargeableKg += max($wt, $cbm * self::VOLUMETRIC_FACTOR) * (int) $line['quantity'];
        }

        $deliveryExplanation = self::buildDeliveryExplanation(
            $region,
            $localPercent,
            $preorderCount,
            round($chargeableKg, 2),
            $intl > 0,
            $deliveryMode === 'pickup'
        );

        $shopPickupOffer = ShopService::resolveShopPickupOffer($pdo, $lines);
        $shopPickupAvailable = $shopPickupOffer !== null && $hasShopItems && !$hasDpmItems;
        $effectiveShopMode = 'delivery';
        if ($shopFulfillmentMode === 'shop_pickup' && $shopPickupAvailable) {
            $effectiveShopMode = 'shop_pickup';
        }

        $shopNote = null;
        if ($hasShopItems) {
            if ($effectiveShopMode === 'shop_pickup' && $shopPickupOffer !== null) {
                $shopNote = 'Collect your order at ' . ($shopPickupOffer['shop_name'] ?? 'the shop') . '. No delivery address needed.';
            } else {
                $shopNote = 'Marketplace items are delivered by the seller. Delivery fees are paid directly to the seller — not in this checkout total.';
            }
        }

        return [
            'subtotal'               => $subtotal,
            'dpm_subtotal'           => $dpmSubtotal,
            'shop_subtotal'          => $shopSubtotal,
            'has_shop_items'         => $hasShopItems,
            'has_dpm_items'          => $hasDpmItems,
            'intl_shipping_cost'     => $intl,
            'local_delivery_cost'    => $local,
            'local_delivery_percent' => $localPercent,
            'total'                  => round($subtotal + $intl + $local, 2),
            'currency'               => 'GHS',
            'lines'                  => $lines,
            'errors'                 => $errors,
            'delivery_explanation'   => $deliveryExplanation,
            'delivery_mode'          => $deliveryMode,
            'pickup_station_id'      => $deliveryMode === 'pickup' ? $pickupStationId : null,
            'shop_delivery_note'     => $shopNote,
            'shop_pickup_available'  => $shopPickupAvailable,
            'shop_pickup'            => $shopPickupOffer,
            'shop_fulfillment_mode'  => $effectiveShopMode,
        ];
    }

    /**
     * @return array{line:string,local_rule:string,local_zone:?string,intl_rule:?string,intl_weight_note:?string}
     */
    public static function buildDeliveryExplanation(
        ?string $region,
        float $localPercent,
        int $preorderCount,
        float $chargeableKg,
        bool $hasIntl,
        bool $isPickup = false
    ): array {
        $zone = $region !== null && trim($region) !== '' ? trim($region) : 'Ghana';
        if ($isPickup) {
            $localRule = 'Pickup & handling fee';
            $parts = [$zone, 'collect at station'];
        } else {
            $localRule = $localPercent . '% of subtotal';
            $parts = [$zone, 'local ' . $localRule];
        }

        $intlRule = null;
        $intlNote = null;
        if ($hasIntl && $preorderCount > 0) {
            $intlRule = 'International delivery (by air)';
            $parts[] = 'intl by air';
        }

        return [
            'line'               => implode(' · ', $parts),
            'local_rule'         => $localRule,
            'local_zone'         => $zone,
            'intl_rule'          => $intlRule,
            'intl_weight_note'   => null,
        ];
    }
}
