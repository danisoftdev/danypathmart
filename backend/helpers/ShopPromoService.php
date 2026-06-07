<?php

declare(strict_types=1);

namespace App\Helpers;

/** Shop-managed promo badges on marketplace listings (Phase M6). */
final class ShopPromoService
{
    public const PRESET_LABELS = ['Promo', 'Hot cake', 'New', 'Sale', 'Limited'];

    /**
     * @param array<string,mixed> $input
     * @return array{shop_badge_label:?string,shop_promo_free_delivery:int}
     */
    public static function parseInput(array $input): array
    {
        $label = trim((string) ($input['shop_badge_label'] ?? ''));
        if ($label === '' || strtolower($label) === 'none') {
            $label = null;
        } elseif (strlen($label) > 40) {
            $label = substr($label, 0, 40);
        }

        $freeDelivery = !empty($input['shop_promo_free_delivery']) ? 1 : 0;

        return [
            'shop_badge_label'          => $label,
            'shop_promo_free_delivery'  => $freeDelivery,
        ];
    }

    /** @return list<string> Badges shown on cards and PDP (public). */
    public static function displayBadges(array $row): array
    {
        if (empty($row['shop_id'])) {
            return self::dpmBadges($row);
        }

        if (!empty($row['shop_badge_hidden'])) {
            return [];
        }

        $badges = [];
        $label = trim((string) ($row['shop_badge_label'] ?? ''));
        if ($label !== '') {
            $badges[] = $label;
        }
        if (!empty($row['shop_promo_free_delivery'])) {
            $badges[] = 'Free delivery';
        }

        return $badges;
    }

    /** @return list<string> */
    private static function dpmBadges(array $row): array
    {
        $badges = [];
        $label = trim((string) ($row['badge_label'] ?? ''));
        if ($label !== '') {
            $badges[] = $label;
        }

        return $badges;
    }

    /** @param array<string,mixed> $row */
    public static function promoMeta(array $row): array
    {
        return [
            'shop_badge_label'         => $row['shop_badge_label'] ?? null,
            'shop_promo_free_delivery' => !empty($row['shop_promo_free_delivery']),
            'shop_badge_hidden'        => !empty($row['shop_badge_hidden']),
            'display_badges'           => self::displayBadges($row),
        ];
    }
}
