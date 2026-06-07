<?php



declare(strict_types=1);



namespace App\Helpers;



use PDO;



/** Core-store pilot toggles — disables logistics, marketplace, HR, and analytics noise. */

final class PilotPresetService

{

    /** @return list<string> Human-readable labels of modules turned off */

    public static function apply(PDO $pdo): array

    {

        $disabled = [];



        $platformOff = [

            'careers_enabled'                  => 'Careers',

            'driver_hiring_enabled'            => 'Driver hiring',

            'pickup_stations_enabled'          => 'Pickup stations',

            'marketplace_enabled'              => 'Marketplace',

            'shop_applications_open'           => 'Shop applications',

            'driver_module_enabled'            => 'Driver logistics',

            'station_repack_module_enabled'    => 'Station repack',

            'shop_referral_commission_enabled' => 'Shop referral commission',

        ];



        try {

            $sets = [];

            $params = [];

            foreach ($platformOff as $col => $label) {

                $sets[] = "{$col} = 0";

                $disabled[] = $label;

            }

            $pdo->exec('UPDATE company_settings SET ' . implode(', ', $sets) . ' WHERE id = 1');

        } catch (\Throwable) {

            // Platform columns may be missing on very old DBs.

        }



        try {

            $pdo->exec('UPDATE company_settings SET leave_requests_enabled = 0 WHERE id = 1');

            $disabled[] = 'Leave requests (HR)';

        } catch (\Throwable) {

        }



        try {

            $pdo->exec(

                'UPDATE company_settings SET analytics_enabled = 0, google_analytics_id = NULL WHERE id = 1'

            );

            $disabled[] = 'Storefront analytics';

        } catch (\Throwable) {

        }



        return $disabled;

    }

}

