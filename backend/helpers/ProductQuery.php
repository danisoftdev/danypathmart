<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Builds the parameterised WHERE/ORDER clauses shared by the product listing
 * and full-text search endpoints. Every user value is bound, never inlined.
 */
final class ProductQuery
{
    /**
     * @param array<string,mixed> $q  Request query parameters.
     * @return array{0:string,1:array<int,mixed>}  [whereSql, bindings]
     */
    public static function filters(array $q): array
    {
        $where = ["status = 'active'"];
        $params = [];

        if (!empty($q['category_id'])) {
            $where[] = 'category_id = ?';
            $params[] = (int) $q['category_id'];
        }

        if (isset($q['price_min']) && $q['price_min'] !== '') {
            $where[] = 'price >= ?';
            $params[] = (float) $q['price_min'];
        }

        if (isset($q['price_max']) && $q['price_max'] !== '') {
            $where[] = 'price <= ?';
            $params[] = (float) $q['price_max'];
        }

        if (isset($q['is_preorder']) && in_array((string) $q['is_preorder'], ['0', '1'], true)) {
            $where[] = 'is_preorder = ?';
            $params[] = (int) $q['is_preorder'];
        }

        if (isset($q['in_stock']) && (string) $q['in_stock'] === '1') {
            $where[] = 'stock_qty > 0';
        }

        $term = trim((string) ($q['search'] ?? $q['q'] ?? ''));
        if ($term !== '') {
            $where[] = "(name LIKE ? OR description LIKE ? OR JSON_SEARCH(tags, 'one', ?) IS NOT NULL)";
            $like = '%' . $term . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        return [implode(' AND ', $where), $params];
    }

    public static function orderBy(?string $sort): string
    {
        return match ($sort) {
            'price_asc'  => 'price ASC',
            'price_desc' => 'price DESC',
            'newest'     => 'created_at DESC',
            default      => 'created_at DESC',
        };
    }

    /**
     * Clamp a page number to >= 1.
     */
    public static function page(mixed $value): int
    {
        $page = (int) $value;
        return $page < 1 ? 1 : $page;
    }

    /**
     * Clamp per-page within sane bounds.
     */
    public static function perPage(mixed $value, int $default = 12, int $max = 48): int
    {
        $n = (int) $value;
        if ($n < 1) {
            return $default;
        }
        return min($n, $max);
    }
}
