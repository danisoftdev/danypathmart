<?php

declare(strict_types=1);

namespace App\Helpers;

/** Shared location / map helpers for shops and company settings. */
final class LocationHelper
{
    public static function parseCoordinate(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $f = (float) $value;
        if ($f < -180 || $f > 180) {
            return null;
        }

        return round($f, 7);
    }

    /** @return array{latitude:?float,longitude:?float} */
    public static function parseLatLng(array $input): array
    {
        $lat = self::parseCoordinate($input['latitude'] ?? null);
        $lng = self::parseCoordinate($input['longitude'] ?? null);
        if ($lat === null || $lng === null) {
            return ['latitude' => null, 'longitude' => null];
        }
        if ($lat < -90 || $lat > 90) {
            return ['latitude' => null, 'longitude' => null];
        }

        return ['latitude' => $lat, 'longitude' => $lng];
    }

    public static function hasPin(?float $lat, ?float $lng): bool
    {
        return $lat !== null && $lng !== null;
    }

    /** @return array<string,mixed> */
    public static function publicLocationFields(array $row): array
    {
        $lat = isset($row['latitude']) && $row['latitude'] !== null ? (float) $row['latitude'] : null;
        $lng = isset($row['longitude']) && $row['longitude'] !== null ? (float) $row['longitude'] : null;

        return [
            'street_address'    => $row['street_address'] ?? null,
            'region'            => $row['region'] ?? null,
            'city'              => $row['city'] ?? null,
            'latitude'          => $lat,
            'longitude'         => $lng,
            'has_map_pin'       => self::hasPin($lat, $lng),
            'allows_shop_pickup'=> (int) ($row['allows_shop_pickup'] ?? 0) === 1,
            'directions_url'    => self::hasPin($lat, $lng)
                ? self::googleDirectionsUrl($lat, $lng)
                : null,
        ];
    }

    public static function googleDirectionsUrl(float $lat, float $lng): string
    {
        return 'https://www.google.com/maps/dir/?api=1&destination=' . rawurlencode("{$lat},{$lng}");
    }
}
