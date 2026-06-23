<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Normalises raw `products` rows for JSON output: decodes the images/tags
 * JSON columns and casts numeric/boolean fields to their proper types.
 */
final class ProductPresenter
{
    /**
     * Compact shape used by listings, autocomplete and search results.
     *
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    public static function summary(array $r): array
    {
        return [
            'id'          => (int) $r['id'],
            'name'        => $r['name'],
            'slug'        => $r['slug'],
            'price'       => (float) $r['price'],
            'cost_price'  => (float) ($r['cost_price'] ?? 0),
            'compare_at_price' => isset($r['compare_at_price']) && $r['compare_at_price'] !== null
                ? (float) $r['compare_at_price']
                : null,
            'rating_avg'  => isset($r['rating_avg']) && $r['rating_avg'] !== null ? (float) $r['rating_avg'] : null,
            'rating_count' => (int) ($r['rating_count'] ?? 0),
            'badge_label' => $r['badge_label'] ?? null,
            'display_badges' => ShopPromoService::displayBadges($r),
            'is_featured' => (bool) ($r['is_featured'] ?? 0),
            'is_flash_deal' => (bool) ($r['is_flash_deal'] ?? 0),
            'images'      => self::decodeJson($r['images'] ?? null),
            'tags'        => self::decodeJson($r['tags'] ?? null),
            'is_preorder' => (bool) ($r['is_preorder'] ?? 0),
            'requires_custom_proof' => (bool) ($r['requires_custom_proof'] ?? 0),
            'stock_qty'   => (int) ($r['stock_qty'] ?? 0),
            'units_sold'  => (int) ($r['units_sold'] ?? 0),
            'category_id' => isset($r['category_id']) ? (int) $r['category_id'] : null,
            'category_name' => $r['category_name'] ?? null,
            'category_slug' => $r['category_slug'] ?? null,
            'origin_country' => $r['origin_country'] ?? null,
            'shop_id'     => isset($r['shop_id']) && $r['shop_id'] !== null ? (int) $r['shop_id'] : null,
            'listing_status' => $r['listing_status'] ?? 'none',
            'shop'        => self::shopFromRow($r),
            'shop_promo'  => !empty($r['shop_id']) ? ShopPromoService::promoMeta($r) : null,
        ];
    }

    /** @param array<string,mixed> $r */
    private static function shopFromRow(array $r): ?array
    {
        if (empty($r['shop_id'])) {
            return null;
        }
        if (!empty($r['shop_name']) && !empty($r['shop_slug'])) {
            return [
                'id'       => (int) $r['shop_id'],
                'name'     => (string) $r['shop_name'],
                'slug'     => (string) $r['shop_slug'],
                'logo_url' => $r['shop_logo'] ?? null,
            ];
        }

        return null;
    }

    /**
     * Full shape for the product detail page (adds description + CBM fields).
     *
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    public static function full(array $r): array
    {
        return self::summary($r) + [
            'description'            => $r['description'] ?? null,
            'origin_country'         => $r['origin_country'] ?? null,
            'cbm_length'             => self::nullableFloat($r['cbm_length'] ?? null),
            'cbm_width'              => self::nullableFloat($r['cbm_width'] ?? null),
            'cbm_height'             => self::nullableFloat($r['cbm_height'] ?? null),
            'cbm_weight'             => self::nullableFloat($r['cbm_weight'] ?? null),
            'intl_freight_rate'      => self::nullableFloat($r['intl_freight_rate'] ?? null),
            'estimated_arrival_days' => isset($r['estimated_arrival_days']) && $r['estimated_arrival_days'] !== null
                ? (int) $r['estimated_arrival_days']
                : null,
            'status'                 => $r['status'] ?? 'active',
            'created_at'             => $r['created_at'] ?? null,
        ];
    }

    /**
     * @return array<int,mixed>
     */
    private static function decodeJson(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function nullableFloat(mixed $value): ?float
    {
        return $value === null ? null : (float) $value;
    }
}
