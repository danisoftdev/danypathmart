<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** DPM catalog search for POS (shop_id IS NULL). */
final class PosProductService
{
    /** @return list<array<string,mixed>> */
    public static function search(PDO $pdo, string $query, int $limit = 30): array
    {
        $q = trim($query);
        $limit = max(1, min($limit, 50));

        if ($q === '') {
            return self::recent($pdo, $limit);
        }

        $like = '%' . $q . '%';
        $stmt = $pdo->prepare(
            "SELECT p.id, p.name, p.slug, p.price, p.stock_qty, p.images, p.is_preorder, p.shop_id
             FROM products p
             WHERE p.status = 'active'
               AND (p.shop_id IS NULL OR p.shop_id = 0)
               AND p.is_preorder = 0
               AND (p.name LIKE ? OR p.slug LIKE ? OR CAST(p.id AS CHAR) = ?)
             ORDER BY p.name ASC
             LIMIT {$limit}"
        );
        $stmt->execute([$like, $like, $q]);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function find(PDO $pdo, int $productId): ?array
    {
        $stmt = $pdo->prepare(
            "SELECT p.id, p.name, p.slug, p.price, p.stock_qty, p.images, p.is_preorder, p.shop_id, p.cost_price
             FROM products p
             WHERE p.id = ? AND p.status = 'active'
               AND (p.shop_id IS NULL OR p.shop_id = 0)
               AND p.is_preorder = 0"
        );
        $stmt->execute([$productId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /**
     * @param array<int,array{product_id:int,quantity:int}> $items
     * @return array{lines:array<int,array<string,mixed>>,subtotal:float,discount_amount:float,total:float,errors:array<int,array<string,mixed>>}
     */
    public static function quote(PDO $pdo, array $items, float $discountAmount = 0.0): array
    {
        $errors = [];
        $lines = [];
        $subtotal = 0.0;
        $discountAmount = round(max(0, $discountAmount), 2);

        foreach ($items as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $qty = max(1, (int) ($item['quantity'] ?? 1));
            if ($pid <= 0) {
                continue;
            }

            $product = self::find($pdo, $pid);
            if ($product === null) {
                $errors[] = ['product_id' => $pid, 'error' => 'unavailable'];
                continue;
            }
            if ((int) $product['stock_qty'] < $qty) {
                $errors[] = [
                    'product_id' => $pid,
                    'name'       => $product['name'],
                    'error'      => 'out_of_stock',
                    'available'  => (int) $product['stock_qty'],
                ];
                continue;
            }

            $lineTotal = round((float) $product['price'] * $qty, 2);
            $subtotal += $lineTotal;
            $lines[] = [
                'product'    => $product,
                'quantity'   => $qty,
                'unit_price' => round((float) $product['price'], 2),
                'line_total' => $lineTotal,
            ];
        }

        $subtotal = round($subtotal, 2);
        if ($discountAmount > $subtotal) {
            $discountAmount = $subtotal;
        }

        return [
            'lines'            => $lines,
            'subtotal'         => $subtotal,
            'discount_amount'  => $discountAmount,
            'total'            => round($subtotal - $discountAmount, 2),
            'errors'           => $errors,
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function recent(PDO $pdo, int $limit): array
    {
        $stmt = $pdo->query(
            "SELECT p.id, p.name, p.slug, p.price, p.stock_qty, p.images, p.is_preorder, p.shop_id
             FROM products p
             WHERE p.status = 'active'
               AND (p.shop_id IS NULL OR p.shop_id = 0)
               AND p.is_preorder = 0
               AND p.stock_qty > 0
             ORDER BY p.updated_at DESC
             LIMIT {$limit}"
        );

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        $images = json_decode((string) ($row['images'] ?? ''), true);

        return [
            'id'          => (int) $row['id'],
            'name'        => (string) $row['name'],
            'slug'        => (string) $row['slug'],
            'price'       => round((float) $row['price'], 2),
            'stock_qty'   => (int) $row['stock_qty'],
            'cost_price'  => isset($row['cost_price']) ? round((float) $row['cost_price'], 2) : 0.0,
            'image'       => is_array($images) && isset($images[0]) ? $images[0] : null,
            'is_preorder' => (int) ($row['is_preorder'] ?? 0) === 1,
        ];
    }
}
