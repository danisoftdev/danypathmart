<?php

declare(strict_types=1);

namespace App\Helpers;

/**
 * Planned platform roles (M1 placeholders — wired in later marketplace/logistics phases).
 * Current users.role ENUM remains super_admin | staff | customer.
 */
final class PlatformRoles
{
    public const SHOP_OWNER = 'shop_owner';
    public const SHOP_STAFF = 'shop_staff';
    public const DRIVER = 'driver';
    public const STATION_STAFF = 'station_staff';

    /** @return list<string> */
    public static function planned(): array
    {
        return [
            self::SHOP_OWNER,
            self::SHOP_STAFF,
            self::DRIVER,
            self::STATION_STAFF,
        ];
    }
}
