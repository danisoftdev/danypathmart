<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Shared filters for admin product list / export / reset / inventory print. */
final class AdminProductFilters
{
    public const LOW_STOCK_MAX = 5;

    /**
     * @param array<string,mixed> $query
     * @return array{sql:string,params:list<mixed>}
     */
    public static function apply(string $alias, array $query, bool $dpmOnly = true): array
    {
        $p = $alias !== '' ? $alias . '.' : '';
        $sql = '';
        $params = [];

        if ($dpmOnly) {
            // DPM warehouse catalogue only — never touch marketplace shop stock.
            $sql .= " AND ({$p}shop_id IS NULL OR {$p}shop_id = 0)";
        }

        $status = trim((string) ($query['status'] ?? ''));
        if ($status !== '' && in_array($status, ['active', 'inactive', 'draft'], true)) {
            $sql .= " AND {$p}status = ?";
            $params[] = $status;
        }

        $categoryId = isset($query['category_id']) && $query['category_id'] !== ''
            ? (int) $query['category_id']
            : 0;
        if ($categoryId > 0) {
            $sql .= " AND {$p}category_id = ?";
            $params[] = $categoryId;
        }

        $flashDeal = trim((string) ($query['is_flash_deal'] ?? ''));
        if ($flashDeal !== '' && in_array($flashDeal, ['0', '1'], true)) {
            $sql .= " AND {$p}is_flash_deal = ?";
            $params[] = (int) $flashDeal;
        }

        $search = trim((string) ($query['search'] ?? ''));
        if ($search !== '') {
            $sql .= " AND ({$p}name LIKE ? OR {$p}slug LIKE ? OR {$p}barcode LIKE ?)";
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $stockStatus = trim((string) ($query['stock_status'] ?? ''));
        if ($stockStatus === 'in_stock') {
            $sql .= " AND {$p}stock_qty > 0";
        } elseif ($stockStatus === 'low') {
            $sql .= " AND {$p}stock_qty > 0 AND {$p}stock_qty <= ?";
            $params[] = self::LOW_STOCK_MAX;
        } elseif ($stockStatus === 'out') {
            $sql .= " AND {$p}stock_qty <= 0";
        }

        return ['sql' => $sql, 'params' => $params];
    }

    /** @param array<string,mixed> $query */
    public static function countMatching(PDO $pdo, array $query, bool $dpmOnly = true): int
    {
        $f = self::apply('p', $query, $dpmOnly);
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM products p WHERE 1=1' . $f['sql']);
        $stmt->execute($f['params']);

        return (int) $stmt->fetchColumn();
    }
}
