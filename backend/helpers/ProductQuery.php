<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

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

        $categorySlug = trim((string) ($q['category_slug'] ?? ''));
        if ($categorySlug !== '') {
            $where[] = 'category_id IN (SELECT id FROM categories WHERE slug = ?)';
            $params[] = $categorySlug;
        }

        $tag = trim((string) ($q['tag'] ?? ''));
        if ($tag !== '') {
            $where[] = "JSON_SEARCH(tags, 'one', ?) IS NOT NULL";
            $params[] = $tag;
        }

        $origin = trim((string) ($q['origin_country'] ?? ''));
        if ($origin !== '') {
            $where[] = 'origin_country = ?';
            $params[] = $origin;
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

        if (!empty($q['is_featured']) && in_array((string) $q['is_featured'], ['0', '1'], true)) {
            $where[] = 'is_featured = ?';
            $params[] = (int) $q['is_featured'];
        }

        if (!empty($q['is_flash_deal']) && in_array((string) $q['is_flash_deal'], ['0', '1'], true)) {
            $where[] = 'is_flash_deal = ?';
            $params[] = (int) $q['is_flash_deal'];
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

    /**
     * Public catalogue visibility for DPM vs marketplace listings.
     *
     * @return array{0:string,1:array<int,mixed>}
     */
    public static function marketplaceVisibility(PDO $pdo, ?int $shopId = null): array
    {
        $params = [];
        if ($shopId !== null && $shopId > 0) {
            return ['shop_id = ? AND listing_status = ? AND status = ?', [$shopId, 'approved', 'active']];
        }

        $features = PlatformFeatures::load($pdo);
        if (!$features['marketplace_enabled']) {
            return ['shop_id IS NULL', []];
        }

        return ["(shop_id IS NULL OR listing_status = 'approved')", []];
    }

    public static function orderBy(?string $sort): string
    {
        return match ($sort) {
            'price_asc'  => 'price ASC',
            'price_desc' => 'price DESC',
            'name_asc'   => 'name ASC',
            'name_desc'  => 'name DESC',
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
