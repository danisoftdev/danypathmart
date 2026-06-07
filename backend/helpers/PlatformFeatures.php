<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Company-settings feature flags for marketplace, logistics, and labelling (Phase M1+). */
final class PlatformFeatures
{
    /** @return array<string, bool> */
    public static function defaults(): array
    {
        return [
            'by_air_label_enabled'            => true,
            'careers_enabled'                 => false,
            'driver_hiring_enabled'           => false,
            'pickup_stations_enabled'         => false,
            'marketplace_enabled'             => false,
            'shop_applications_open'            => false,
            'driver_module_enabled'           => false,
            'station_repack_module_enabled'   => false,
            'shop_referral_commission_enabled'=> false,
        ];
    }

    /**
     * @return array<string, bool>
     */
    public static function fromRow(array|false $row): array
    {
        $defaults = self::defaults();
        if ($row === false) {
            return $defaults;
        }

        $out = [];
        foreach ($defaults as $key => $default) {
            $out[$key] = array_key_exists($key, $row)
                ? (int) ($row[$key] ?? 0) === 1
                : $default;
        }

        return $out;
    }

    /**
     * @return array<string, bool>
     */
    public static function load(PDO $pdo): array
    {
        $cols = implode(', ', array_keys(self::defaults()));

        try {
            $row = $pdo->query(
                "SELECT {$cols} FROM company_settings ORDER BY id ASC LIMIT 1"
            )->fetch();
        } catch (\Throwable) {
            return self::defaults();
        }

        return self::fromRow($row);
    }

    /**
     * Flags exposed on public checkout-policies (no auth).
     *
     * @return array<string, bool>
     */
    public static function publicFlags(PDO $pdo): array
    {
        $all = self::load($pdo);

        return [
            'by_air_label_enabled'     => $all['by_air_label_enabled'],
            'careers_enabled'          => $all['careers_enabled'],
            'driver_hiring_enabled'    => $all['driver_hiring_enabled'],
            'pickup_stations_enabled'  => $all['pickup_stations_enabled'],
            'marketplace_enabled'      => $all['marketplace_enabled'],
            'shop_applications_open'           => $all['shop_applications_open'],
            'shop_referral_commission_enabled' => $all['shop_referral_commission_enabled'] && $all['marketplace_enabled'],
            'driver_module_enabled'          => $all['driver_module_enabled'],
            'station_repack_module_enabled'  => $all['station_repack_module_enabled'],
        ];
    }
}
