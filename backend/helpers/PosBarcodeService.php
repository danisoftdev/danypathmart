<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** DPM internal barcode format: DPM00000123 */
final class PosBarcodeService
{
    public static function format(int $productId): string
    {
        return 'DPM' . str_pad((string) $productId, 8, '0', STR_PAD_LEFT);
    }

    public static function assignIfMissing(PDO $pdo, int $productId): ?string
    {
        $stmt = $pdo->prepare(
            'SELECT id, barcode, shop_id FROM products WHERE id = ?'
        );
        $stmt->execute([$productId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }
        $shopId = isset($row['shop_id']) ? (int) $row['shop_id'] : 0;
        if ($shopId > 0) {
            return $row['barcode'] !== null ? (string) $row['barcode'] : null;
        }
        if ($row['barcode'] !== null && trim((string) $row['barcode']) !== '') {
            return (string) $row['barcode'];
        }

        $code = self::format($productId);
        $pdo->prepare('UPDATE products SET barcode = ? WHERE id = ?')->execute([$code, $productId]);

        return $code;
    }

    /** @return array{updated:int,skipped:int} */
    public static function backfillDpmCatalog(PDO $pdo): array
    {
        $stmt = $pdo->query(
            "SELECT id FROM products
             WHERE (shop_id IS NULL OR shop_id = 0)
               AND (barcode IS NULL OR TRIM(barcode) = '')
             ORDER BY id ASC"
        );
        $updated = 0;
        foreach ($stmt->fetchAll() as $row) {
            $id = (int) $row['id'];
            $pdo->prepare('UPDATE products SET barcode = ? WHERE id = ?')->execute([self::format($id), $id]);
            $updated++;
        }

        return ['updated' => $updated, 'skipped' => 0];
    }

    /** @return list<array<string,mixed>> */
    public static function labelData(PDO $pdo, ?array $productIds = null): array
    {
        $sql = "SELECT id, name, price, barcode FROM products
                WHERE (shop_id IS NULL OR shop_id = 0)
                  AND status = 'active'
                  AND barcode IS NOT NULL AND TRIM(barcode) != ''";
        $params = [];
        if ($productIds !== null && $productIds !== []) {
            $ids = array_values(array_filter(array_map('intval', $productIds), static fn (int $i): bool => $i > 0));
            if ($ids === []) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $sql .= " AND id IN ({$placeholders})";
            $params = $ids;
        }
        $sql .= ' ORDER BY name ASC LIMIT 500';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => [
            'id'      => (int) $r['id'],
            'name'    => (string) $r['name'],
            'price'   => round((float) $r['price'], 2),
            'barcode' => (string) $r['barcode'],
        ], $stmt->fetchAll());
    }
}
