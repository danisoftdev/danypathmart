<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** G1 — repeat club / group order loyalty discount. */
final class ClubLoyaltyService
{
    /**
     * @return array{
     *   enabled:bool, mode:string, percent:float
     * }
     */
    public static function settings(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT repeat_club_discount_enabled, repeat_club_discount_mode, repeat_club_discount_percent
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return ['enabled' => false, 'mode' => 'percent', 'percent' => 0.0];
        }

        if ($row === false) {
            return ['enabled' => false, 'mode' => 'percent', 'percent' => 0.0];
        }

        return [
            'enabled' => (int) ($row['repeat_club_discount_enabled'] ?? 0) === 1,
            'mode'    => (string) ($row['repeat_club_discount_mode'] ?? 'percent'),
            'percent' => round((float) ($row['repeat_club_discount_percent'] ?? 0), 2),
        ];
    }

    public static function isRepeatClubOrder(PDO $pdo, int $userId, string $organizationName): bool
    {
        $org = self::normalizeOrg($organizationName);
        if ($org === '') {
            return false;
        }

        $stmt = $pdo->prepare(
            "SELECT 1 FROM orders
             WHERE user_id = ? AND payment_status = 'paid'
               AND order_type IN ('group', 'institutional')
               AND LOWER(TRIM(COALESCE(organization_name, ''))) = ?
             LIMIT 1"
        );
        $stmt->execute([$userId, $org]);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * @param array<string,mixed> $quote
     * @return array<string,mixed>
     */
    public static function apply(PDO $pdo, array $quote, int $userId, string $orderType, string $organizationName): array
    {
        $quote['discount_amount'] = 0.0;
        $quote['discount_label'] = null;

        if (!in_array($orderType, ['group', 'institutional'], true)) {
            return $quote;
        }

        $settings = self::settings($pdo);
        if (!$settings['enabled'] || !self::isRepeatClubOrder($pdo, $userId, $organizationName)) {
            return $quote;
        }

        $subtotal = (float) ($quote['subtotal'] ?? 0);
        $intl = (float) ($quote['intl_shipping_cost'] ?? 0);
        $local = (float) ($quote['local_delivery_cost'] ?? 0);
        $localPct = (float) ($quote['local_delivery_percent'] ?? 0);
        $discount = 0.0;
        $label = 'Repeat club loyalty';

        if ($settings['mode'] === 'free_local_delivery') {
            $discount = $local;
            $local = 0.0;
            $label = 'Repeat club — free local delivery';
        } else {
            $pct = max(0.0, min(100.0, $settings['percent']));
            $discount = round($subtotal * ($pct / 100.0), 2);
            $subtotal = round($subtotal - $discount, 2);
            $local = round($subtotal * ($localPct / 100.0), 2);
            $label = 'Repeat club — ' . rtrim(rtrim(number_format($pct, 2), '0'), '.') . '% off';
        }

        $quote['subtotal'] = $subtotal;
        $quote['local_delivery_cost'] = $local;
        $quote['total'] = round($subtotal + $intl + $local, 2);
        $quote['discount_amount'] = round($discount, 2);
        $quote['discount_label'] = $label;

        return $quote;
    }

    private static function normalizeOrg(string $name): string
    {
        return mb_strtolower(trim($name));
    }
}
