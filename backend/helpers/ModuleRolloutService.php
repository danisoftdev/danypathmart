<?php



declare(strict_types=1);



namespace App\Helpers;



use PDO;



/** Phase 2 — enable logistics, HR, and ops modules one at a time. */

final class ModuleRolloutService

{

    /** @return list<array<string,mixed>> */

    public static function catalog(): array

    {

        return [

            [

                'id'          => 'pickup_stations',

                'label'       => 'Pickup stations',

                'description' => 'Customer pickup locations at checkout.',

                'column'      => 'pickup_stations_enabled',

                'setup_admin' => '/admin/pickup-stations',

                'phase'       => 'P3',

            ],

            [

                'id'          => 'driver_logistics',

                'label'       => 'Driver logistics',

                'description' => 'Hub handoff, delivery runs, and driver accounts.',

                'columns'     => ['driver_module_enabled', 'driver_hiring_enabled'],

                'setup_admin' => '/admin/delivery-runs',

                'phase'       => 'P3',

            ],

            [

                'id'          => 'station_repack',

                'label'       => 'Station repack',

                'description' => 'Station staff repack orders for pickup.',

                'column'      => 'station_repack_module_enabled',

                'setup_admin' => '/admin/station-staff',

                'requires'    => ['pickup_stations'],

                'phase'       => 'P3',

            ],

            [

                'id'          => 'marketplace',

                'label'       => 'Marketplace',

                'description' => 'Third-party sellers, commissions, and shop billing (registration + renewal — planned).',

                'columns'     => ['marketplace_enabled', 'shop_applications_open'],

                'setup_admin' => '/admin/marketplace',

                'phase'       => 'P3',

            ],

            [

                'id'          => 'careers',

                'label'       => 'Careers & hiring',

                'description' => 'Public job posts and applications.',

                'column'      => 'careers_enabled',

                'setup_admin' => '/admin/job-posts',

                'phase'       => 'P3',

            ],

            [

                'id'          => 'hr',

                'label'       => 'Leave requests (HR)',

                'description' => 'Employee profiles and leave approve/reject.',

                'column'      => 'leave_requests_enabled',

                'setup_admin' => '/admin/leave-requests',

                'phase'       => 'P4',

            ],

            [

                'id'          => 'analytics',

                'label'       => 'Storefront analytics',

                'description' => 'GA4 page views on the public store.',

                'column'      => 'analytics_enabled',

                'setup_admin' => '/admin/company-settings',

                'phase'       => 'P5',

            ],

        ];

    }



    /** @return array{modules:list<array<string,mixed>>,phase1_ready:bool} */
    public static function status(PDO $pdo, ?array $launchResult = null): array
    {

        $flags = PlatformFeatures::load($pdo);

        $hr = HrSettings::load($pdo);

        $ops = OpsSettings::load($pdo);



        $enabled = static fn (string $col): bool => (bool) ($flags[$col] ?? false);



        $state = [

            'pickup_stations'  => $enabled('pickup_stations_enabled'),

            'driver_logistics' => $enabled('driver_module_enabled'),

            'station_repack'   => $enabled('station_repack_module_enabled'),

            'marketplace'      => $enabled('marketplace_enabled'),

            'careers'          => $enabled('careers_enabled'),

            'hr'               => $hr['leave_requests_enabled'],

            'analytics'        => $ops['analytics_enabled'],

        ];



        $modules = [];

        foreach (self::catalog() as $def) {

            $id = (string) $def['id'];

            $requires = $def['requires'] ?? [];

            $blockedBy = [];

            foreach ($requires as $req) {

                if (empty($state[$req])) {

                    $blockedBy[] = $req;

                }

            }



            $modules[] = [

                'id'          => $id,

                'label'       => $def['label'],

                'description' => $def['description'],

                'phase'       => $def['phase'],

                'enabled'     => (bool) ($state[$id] ?? false),

                'setup_admin' => $def['setup_admin'],

                'blocked_by'  => $blockedBy,

                'can_enable'  => $blockedBy === [] && !($state[$id] ?? false),

            ];

        }



        if ($launchResult !== null) {
            $p1 = $launchResult;
            $p2 = $launchResult['p2'] ?? LaunchReadinessService::evaluateP2($pdo, (bool) ($launchResult['ready'] ?? false));
        } else {
            $p1 = LaunchReadinessService::evaluate($pdo);
            $p2 = $p1['p2'] ?? LaunchReadinessService::evaluateP2($pdo, (bool) ($p1['ready'] ?? false));
        }

        return [
            'modules'      => $modules,

            'phase1_ready' => ($p1['ready'] ?? false) && ($p2['ready'] ?? false),

        ];

    }



    /**

     * @return array{message:string,module:array<string,mixed>}

     */

    public static function enable(PDO $pdo, string $moduleId): array

    {

        $def = null;

        foreach (self::catalog() as $row) {

            if ($row['id'] === $moduleId) {

                $def = $row;

                break;

            }

        }



        if ($def === null) {

            throw new \InvalidArgumentException('Unknown module: ' . $moduleId);

        }



        $rollout = self::status($pdo);

        foreach ($rollout['modules'] as $m) {

            if ($m['id'] === $moduleId) {

                if ($m['enabled']) {

                    throw new \RuntimeException($m['label'] . ' is already enabled.');

                }

                if ($m['blocked_by'] !== []) {

                    throw new \RuntimeException(

                        'Enable required modules first: ' . implode(', ', $m['blocked_by'])

                    );

                }

                break;

            }

        }



        if (!$rollout['phase1_ready']) {

            throw new \RuntimeException('Complete Phase 1 (P1 + P2 launch checks) before enabling growth modules.');

        }



        if ($moduleId === 'pickup_stations') {

            $pdo->exec('UPDATE company_settings SET pickup_stations_enabled = 1 WHERE id = 1');

        } elseif ($moduleId === 'driver_logistics') {

            $pdo->exec(

                'UPDATE company_settings SET driver_module_enabled = 1, driver_hiring_enabled = 1 WHERE id = 1'

            );

        } elseif ($moduleId === 'station_repack') {

            $pdo->exec(

                'UPDATE company_settings SET station_repack_module_enabled = 1, pickup_stations_enabled = 1 WHERE id = 1'

            );

        } elseif ($moduleId === 'marketplace') {

            $pdo->exec(

                'UPDATE company_settings SET marketplace_enabled = 1, shop_applications_open = 1 WHERE id = 1'

            );

        } elseif ($moduleId === 'careers') {

            $pdo->exec('UPDATE company_settings SET careers_enabled = 1 WHERE id = 1');

        } elseif ($moduleId === 'hr') {

            $pdo->exec('UPDATE company_settings SET leave_requests_enabled = 1 WHERE id = 1');

        } elseif ($moduleId === 'analytics') {

            $pdo->exec('UPDATE company_settings SET analytics_enabled = 1 WHERE id = 1');

        }



        $updated = self::status($pdo);

        $module = null;

        foreach ($updated['modules'] as $m) {

            if ($m['id'] === $moduleId) {

                $module = $m;

                break;

            }

        }



        return [

            'message' => ($def['label'] ?? $moduleId) . ' enabled — complete setup in admin, then run smoke tests.',

            'module'  => $module ?? ['id' => $moduleId, 'enabled' => true],

        ];

    }

}

