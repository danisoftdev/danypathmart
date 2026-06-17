<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** Automated P1 pilot-commerce readiness checks for admin. */
final class LaunchReadinessService
{
    private const MIN_PRODUCTS = 10;

    /**
     * @return array{
     *   phase:string,
     *   ready:bool,
     *   summary:array{pass:int,warn:int,fail:int},
     *   checks:list<array<string,mixed>>,
     *   manual:list<array<string,mixed>>,
     *   stats:array<string,mixed>
     * }
     */
    public static function evaluate(PDO $pdo): array
    {
        $checks = [];
        $checks[] = self::checkDatabase($pdo);
        $checks[] = self::checkMigrations($pdo);
        $checks = array_merge($checks, self::checkCatalog($pdo));
        $checks = array_merge($checks, self::checkCompany($pdo));
        $checks[] = self::checkShipping($pdo);
        $checks = array_merge($checks, self::checkPayments($pdo));
        $checks = array_merge($checks, self::checkModules($pdo));
        $checks[] = self::checkOrdersPilot($pdo);

        $pass = $warn = $fail = 0;
        foreach ($checks as $c) {
            match ($c['status']) {
                'pass' => $pass++,
                'warn' => $warn++,
                default => $fail++,
            };
        }

        $blocking = array_filter($checks, static fn (array $c): bool => ($c['blocking'] ?? false) && $c['status'] === 'fail');

        $p1Ready = $blocking === [];
        $p2 = self::evaluateP2($pdo, $p1Ready);
        $p3 = self::evaluateP3($pdo, (bool) ($p2['ready'] ?? false));
        $p4 = self::evaluateP4($pdo, (bool) ($p3['ready'] ?? false));
        $p5 = self::evaluateP5($pdo, (bool) ($p4['ready'] ?? false));

        return [
            'phase'   => 'P1',
            'ready'   => $p1Ready,
            'summary' => ['pass' => $pass, 'warn' => $warn, 'fail' => $fail],
            'checks'  => $checks,
            'manual'  => self::manualChecklist(),
            'stats'   => self::stats($pdo),
            'p2'      => $p2,
            'p3'      => $p3,
            'p4'      => $p4,
            'p5'      => $p5,
        ];
    }

    /**
     * P2 public-launch readiness (legal trust, SEO, ops).
     *
     * @return array{
     *   phase:string,
     *   ready:bool,
     *   summary:array{pass:int,warn:int,fail:int},
     *   checks:list<array<string,mixed>>,
     *   manual:list<array<string,mixed>>
     * }
     */
    public static function evaluateP2(PDO $pdo, bool $p1Ready): array
    {
        $checks = [];

        $checks[] = $p1Ready
            ? self::item('p1_prerequisite', 'P1 pilot complete', 'pass', 'Automated P1 checks passed.', true, '/admin/launch-readiness')
            : self::item('p1_prerequisite', 'P1 pilot complete', 'fail', 'Complete P1 blocking checks before public marketing.', true, '/admin/launch-readiness');

        $requiredPolicies = [
            'returns' => 'Returns & refunds',
            'privacy' => 'Privacy policy',
            'terms'   => 'Terms of service',
        ];

        foreach ($requiredPolicies as $slug => $label) {
            try {
                $policy = LegalPolicyService::findPublishedBySlug($pdo, $slug);
            } catch (\Throwable) {
                $policy = null;
            }

            if ($policy !== null) {
                $checks[] = self::item("legal_{$slug}", $label, 'pass', 'Published at /policies/' . $slug, true, '/admin/legal-policies');
            } else {
                $checks[] = self::item(
                    "legal_{$slug}",
                    $label,
                    'fail',
                    'Publish and enable this policy before checkout trust and public launch.',
                    true,
                    '/admin/legal-policies'
                );
            }
        }

        try {
            $footerCount = count(LegalPolicyService::listFooter($pdo));
        } catch (\Throwable) {
            $footerCount = 0;
        }

        if ($footerCount >= 3) {
            $checks[] = self::item('footer_policies', 'Footer policy links', 'pass', "{$footerCount} policies shown in footer.", false, '/admin/legal-policies');
        } elseif ($footerCount >= 1) {
            $checks[] = self::item('footer_policies', 'Footer policy links', 'warn', "{$footerCount} footer link(s) — aim for returns, privacy, and terms.", false, '/admin/legal-policies');
        } else {
            $checks[] = self::item('footer_policies', 'Footer policy links', 'fail', 'No footer policies — tick “Show in footer” on published policies.', true, '/admin/legal-policies');
        }

        try {
            $trustCount = count(LegalPolicyService::checkoutTrustLinks($pdo));
        } catch (\Throwable) {
            $trustCount = 0;
        }

        if ($trustCount >= 3) {
            $checks[] = self::item('checkout_legal', 'Checkout legal links', 'pass', 'Returns, privacy, and terms linked at checkout.', true, '/admin/legal-policies');
        } elseif ($trustCount >= 1) {
            $checks[] = self::item('checkout_legal', 'Checkout legal links', 'warn', "Only {$trustCount}/3 checkout policies published.", true, '/admin/legal-policies');
        } else {
            $checks[] = self::item('checkout_legal', 'Checkout legal links', 'fail', 'Publish returns, privacy, and terms for checkout trust.', true, '/admin/legal-policies');
        }

        $repoRoot = realpath(__DIR__ . '/../../') ?: '';
        $hasRobots = $repoRoot !== '' && is_file($repoRoot . '/frontend/public/robots.txt');
        $hasSitemap = $repoRoot !== '' && is_file($repoRoot . '/frontend/public/sitemap.xml');

        if ($hasRobots && $hasSitemap) {
            $checks[] = self::item('seo_files', 'robots.txt & sitemap', 'pass', 'Static SEO files ship with the frontend build.', false, null);
        } else {
            $missing = array_filter([
                !$hasRobots ? 'robots.txt' : null,
                !$hasSitemap ? 'sitemap.xml' : null,
            ]);
            $checks[] = self::item(
                'seo_files',
                'robots.txt & sitemap',
                'fail',
                'Missing: ' . implode(', ', $missing) . '.',
                true,
                null
            );
        }

        if (Env::isProduction()) {
            $appUrl = trim((string) Env::get('APP_URL', ''));
            if ($appUrl !== '' && str_starts_with($appUrl, 'https://')) {
                $checks[] = self::item('https_api', 'HTTPS API URL', 'pass', 'APP_URL uses HTTPS.', false, null);
            } else {
                $checks[] = self::item('https_api', 'HTTPS API URL', 'fail', 'Set APP_URL to https://danypathmart.store/api in production.', true, null);
            }
        }

        $pass = $warn = $fail = 0;
        foreach ($checks as $c) {
            match ($c['status']) {
                'pass' => $pass++,
                'warn' => $warn++,
                default => $fail++,
            };
        }

        $blocking = array_filter($checks, static fn (array $c): bool => ($c['blocking'] ?? false) && $c['status'] === 'fail');

        return [
            'phase'   => 'P2',
            'ready'   => $blocking === [],
            'summary' => ['pass' => $pass, 'warn' => $warn, 'fail' => $fail],
            'checks'  => $checks,
            'manual'  => self::manualChecklistP2(),
        ];
    }

    /**
     * P3 logistics & marketplace expansion (pickup, drivers, station repack, shops).
     *
     * @return array{
     *   phase:string,
     *   ready:bool,
     *   summary:array{pass:int,warn:int,fail:int},
     *   checks:list<array<string,mixed>>,
     *   manual:list<array<string,mixed>>,
     *   modules:array<string,bool>
     * }
     */
    public static function evaluateP3(PDO $pdo, bool $p2Ready): array
    {
        $flags = PlatformFeatures::load($pdo);
        $checks = [];

        $checks[] = $p2Ready
            ? self::item('p2_prerequisite', 'P2 public launch complete', 'pass', 'Automated P2 checks passed.', true, '/admin/launch-readiness')
            : self::item('p2_prerequisite', 'P2 public launch complete', 'fail', 'Complete P2 before turning on logistics and marketplace modules.', true, '/admin/launch-readiness');

        $logisticsOn =
            $flags['pickup_stations_enabled']
            || $flags['driver_module_enabled']
            || $flags['station_repack_module_enabled']
            || $flags['marketplace_enabled'];

        if (!$logisticsOn) {
            $checks[] = self::item(
                'p3_modules_idle',
                'Logistics & marketplace modules',
                'pass',
                'All P3 modules off — core store only. Enable toggles in Company settings when expanding.',
                false,
                '/admin/company-settings'
            );
        } else {
            $enabled = [];
            if ($flags['pickup_stations_enabled']) {
                $enabled[] = 'pickup stations';
            }
            if ($flags['driver_module_enabled']) {
                $enabled[] = 'driver logistics';
            }
            if ($flags['station_repack_module_enabled']) {
                $enabled[] = 'station repack';
            }
            if ($flags['marketplace_enabled']) {
                $enabled[] = 'marketplace';
            }
            $checks[] = self::item(
                'p3_modules_active',
                'Logistics & marketplace modules',
                'warn',
                'Enabled: ' . implode(', ', $enabled) . '. Complete checks below before customer-facing rollout.',
                false,
                '/admin/company-settings'
            );
        }

        if ($flags['pickup_stations_enabled']) {
            $activeStations = self::countActivePickupStations($pdo);
            if ($activeStations >= 1) {
                $checks[] = self::item(
                    'pickup_stations',
                    'Pickup stations',
                    'pass',
                    "{$activeStations} active station(s) for checkout pickup.",
                    true,
                    '/admin/pickup-stations'
                );
            } else {
                $checks[] = self::item(
                    'pickup_stations',
                    'Pickup stations',
                    'fail',
                    'Pickup is enabled but no active stations — add at least one.',
                    true,
                    '/admin/pickup-stations'
                );
            }
        } else {
            $checks[] = self::item('pickup_stations', 'Pickup stations', 'pass', 'Module off.', false, '/admin/company-settings');
        }

        if ($flags['station_repack_module_enabled']) {
            if (!$flags['pickup_stations_enabled']) {
                $checks[] = self::item(
                    'station_repack',
                    'Station repack',
                    'fail',
                    'Enable pickup stations before station repack.',
                    true,
                    '/admin/company-settings'
                );
            } else {
                $staff = self::countStationStaff($pdo);
                if ($staff >= 1) {
                    $checks[] = self::item(
                        'station_repack',
                        'Station repack',
                        'pass',
                        "{$staff} station staff account(s) assigned to a pickup point.",
                        true,
                        '/admin/station-staff'
                    );
                } else {
                    $checks[] = self::item(
                        'station_repack',
                        'Station repack',
                        'fail',
                        'Create station staff accounts under Station staff.',
                        true,
                        '/admin/station-staff'
                    );
                }
            }
        } else {
            $checks[] = self::item('station_repack', 'Station repack', 'pass', 'Module off.', false, '/admin/company-settings');
        }

        if ($flags['driver_module_enabled']) {
            $drivers = self::countVerifiedDrivers($pdo);
            $needsPickup = !$flags['pickup_stations_enabled'];

            if ($drivers >= 1) {
                $msg = "{$drivers} verified driver account(s).";
                if ($needsPickup) {
                    $msg .= ' Enable pickup stations for hub→station runs.';
                }
                $checks[] = self::item(
                    'driver_logistics',
                    'Driver logistics',
                    $needsPickup ? 'warn' : 'pass',
                    $msg,
                    true,
                    '/admin/delivery-runs'
                );
            } else {
                $checks[] = self::item(
                    'driver_logistics',
                    'Driver logistics',
                    'fail',
                    'Driver module on but no verified drivers — hire via Careers or create driver accounts.',
                    true,
                    '/admin/career-applications'
                );
            }
        } else {
            $checks[] = self::item('driver_logistics', 'Driver logistics', 'pass', 'Module off.', false, '/admin/company-settings');
        }

        if ($flags['driver_hiring_enabled'] && !$flags['careers_enabled']) {
            $checks[] = self::item(
                'driver_hiring',
                'Driver hiring on careers',
                'warn',
                'Driver hiring is on but Careers page is off — enable Careers or disable driver hiring.',
                false,
                '/admin/company-settings'
            );
        }

        if ($flags['marketplace_enabled']) {
            $commission = self::shopCommissionPercent($pdo);
            if ($commission >= 0 && $commission <= 50) {
                $checks[] = self::item(
                    'marketplace_commission',
                    'Marketplace commission',
                    'pass',
                    'Default shop commission: ' . $commission . '%.',
                    true,
                    '/admin/company-settings'
                );
            } else {
                $checks[] = self::item(
                    'marketplace_commission',
                    'Marketplace commission',
                    'fail',
                    'Set default shop commission (0–50%) in Company settings.',
                    true,
                    '/admin/company-settings'
                );
            }

            $activeShops = self::countActiveShops($pdo);
            if ($activeShops >= 1) {
                $checks[] = self::item(
                    'marketplace_shops',
                    'Active marketplace shops',
                    'pass',
                    "{$activeShops} active shop(s).",
                    false,
                    '/admin/marketplace'
                );
            } elseif ($flags['shop_applications_open']) {
                $checks[] = self::item(
                    'marketplace_shops',
                    'Active marketplace shops',
                    'warn',
                    'Applications open but no active shops yet — approve a pilot seller.',
                    false,
                    '/admin/marketplace'
                );
            } else {
                $checks[] = self::item(
                    'marketplace_shops',
                    'Active marketplace shops',
                    'warn',
                    'No active shops — open applications or create a shop manually.',
                    false,
                    '/admin/marketplace'
                );
            }
        } else {
            $checks[] = self::item('marketplace', 'Marketplace', 'pass', 'Module off.', false, '/admin/company-settings');
        }

        $pass = $warn = $fail = 0;
        foreach ($checks as $c) {
            match ($c['status']) {
                'pass' => $pass++,
                'warn' => $warn++,
                default => $fail++,
            };
        }

        $blocking = array_filter($checks, static fn (array $c): bool => ($c['blocking'] ?? false) && $c['status'] === 'fail');

        return [
            'phase'   => 'P3',
            'ready'   => $blocking === [],
            'summary' => ['pass' => $pass, 'warn' => $warn, 'fail' => $fail],
            'checks'  => $checks,
            'manual'  => self::manualChecklistP3($flags),
            'modules' => [
                'pickup_stations_enabled'       => $flags['pickup_stations_enabled'],
                'driver_module_enabled'         => $flags['driver_module_enabled'],
                'station_repack_module_enabled' => $flags['station_repack_module_enabled'],
                'marketplace_enabled'           => $flags['marketplace_enabled'],
            ],
        ];
    }

    private static function countActivePickupStations(PDO $pdo): int
    {
        try {
            return (int) $pdo->query('SELECT COUNT(*) FROM pickup_stations WHERE is_active = 1')->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    private static function countVerifiedDrivers(PDO $pdo): int
    {
        try {
            return (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'driver' AND status = 'verified'")->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    private static function countStationStaff(PDO $pdo): int
    {
        try {
            return (int) $pdo->query(
                "SELECT COUNT(*) FROM users WHERE role = 'station_staff' AND status != 'disabled' AND assigned_pickup_station_id IS NOT NULL"
            )->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    private static function countActiveShops(PDO $pdo): int
    {
        try {
            return (int) $pdo->query("SELECT COUNT(*) FROM shops WHERE status = 'active'")->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    private static function shopCommissionPercent(PDO $pdo): float
    {
        try {
            $row = $pdo->query(
                'SELECT default_shop_commission_percent FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();

            return $row !== false ? (float) ($row['default_shop_commission_percent'] ?? 10) : 10.0;
        } catch (\Throwable) {
            return 10.0;
        }
    }

    /**
     * @param array<string, bool> $flags
     * @return list<array<string,mixed>>
     */
    private static function manualChecklistP3(array $flags): array
    {
        $items = [
            ['id' => 'p3_toggles', 'label' => 'Review module toggles in Company settings — only enable what you operate'],
        ];

        if ($flags['pickup_stations_enabled']) {
            $items[] = ['id' => 'p3_pickup_checkout', 'label' => 'Test checkout with pickup station selection and order confirmation'];
        }
        if ($flags['driver_module_enabled']) {
            $items[] = ['id' => 'p3_driver_run', 'label' => 'Create a hub delivery run and mark stops delivered (admin → Delivery runs)'];
        }
        if ($flags['station_repack_module_enabled']) {
            $items[] = ['id' => 'p3_station_repack', 'label' => 'Station staff can repack an order and mark ready for pickup'];
        }
        if ($flags['marketplace_enabled']) {
            $items[] = ['id' => 'p3_marketplace', 'label' => 'Approve a pilot shop listing and verify seller payout settings'];
        }

        return $items;
    }

    /**
     * P4 workforce HR — employee profiles and leave requests.
     *
     * @return array{
     *   phase:string,
     *   ready:bool,
     *   summary:array{pass:int,warn:int,fail:int},
     *   checks:list<array<string,mixed>>,
     *   manual:list<array<string,mixed>>,
     *   hr_enabled:bool
     * }
     */
    public static function evaluateP4(PDO $pdo, bool $p3Ready): array
    {
        $hr = HrSettings::load($pdo);
        $checks = [];

        $checks[] = $p3Ready
            ? self::item('p3_prerequisite', 'P3 modules ready', 'pass', 'Automated P3 checks passed (or modules off).', true, '/admin/launch-readiness')
            : self::item('p3_prerequisite', 'P3 modules ready', 'fail', 'Complete P3 before enabling workforce HR features.', true, '/admin/launch-readiness');

        $hasLeaveTable = self::tableExists($pdo, 'leave_requests');
        if ($hasLeaveTable) {
            $checks[] = self::item('leave_schema', 'Leave requests table', 'pass', 'HR schema migrated (045).', false, null);
        } else {
            $checks[] = self::item(
                'leave_schema',
                'Leave requests table',
                'fail',
                'Run php backend/scripts/migrate-all.php (migration 045).',
                true,
                null
            );
        }

        if (!$hr['leave_requests_enabled']) {
            $checks[] = self::item(
                'hr_module',
                'Workforce HR module',
                'pass',
                'Leave requests off — enable in Company settings when ready.',
                false,
                '/admin/company-settings'
            );
        } else {
            $checks[] = self::item(
                'hr_module',
                'Workforce HR module',
                'warn',
                'Leave requests enabled — complete employee profiles and approval workflow.',
                false,
                '/admin/company-settings'
            );

            $active = EmployeeProfileService::countActive($pdo);
            if ($active >= 1) {
                $checks[] = self::item(
                    'employee_records',
                    'Employee records',
                    'pass',
                    "{$active} active employee record(s) with staff IDs.",
                    true,
                    '/admin/employees'
                );
            } else {
                $checks[] = self::item(
                    'employee_records',
                    'Employee records',
                    'fail',
                    'No active employees — hire staff, drivers, or station staff first.',
                    true,
                    '/admin/staff'
                );
            }

            $profiled = EmployeeProfileService::countWithProfileBasics($pdo);
            if ($active > 0 && $profiled >= max(1, (int) ceil($active * 0.5))) {
                $checks[] = self::item(
                    'employee_profiles',
                    'Employee profiles',
                    'pass',
                    "{$profiled}/{$active} with department or job title filled.",
                    false,
                    '/admin/employees'
                );
            } elseif ($active > 0) {
                $checks[] = self::item(
                    'employee_profiles',
                    'Employee profiles',
                    'warn',
                    "Only {$profiled}/{$active} profiles have department or job title — complete under Employees.",
                    false,
                    '/admin/employees'
                );
            }

            $days = $hr['default_annual_leave_days'];
            if ($days >= 1 && $days <= 365) {
                $checks[] = self::item(
                    'leave_allowance',
                    'Default annual leave',
                    'pass',
                    "{$days} days configured in company settings.",
                    true,
                    '/admin/company-settings'
                );
            } else {
                $checks[] = self::item(
                    'leave_allowance',
                    'Default annual leave',
                    'fail',
                    'Set default annual leave days (1–365) in Company settings.',
                    true,
                    '/admin/company-settings'
                );
            }
        }

        $pass = $warn = $fail = 0;
        foreach ($checks as $c) {
            match ($c['status']) {
                'pass' => $pass++,
                'warn' => $warn++,
                default => $fail++,
            };
        }

        $blocking = array_filter($checks, static fn (array $c): bool => ($c['blocking'] ?? false) && $c['status'] === 'fail');

        return [
            'phase'      => 'P4',
            'ready'      => $blocking === [],
            'summary'    => ['pass' => $pass, 'warn' => $warn, 'fail' => $fail],
            'checks'     => $checks,
            'manual'     => self::manualChecklistP4($hr['leave_requests_enabled']),
            'hr_enabled' => $hr['leave_requests_enabled'],
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function manualChecklistP4(bool $hrEnabled): array
    {
        $items = [
            ['id' => 'p4_permissions', 'label' => 'Assign view/manage permissions for Employees and Leave requests to HR roles'],
        ];

        if ($hrEnabled) {
            $items[] = ['id' => 'p4_profile', 'label' => 'Update at least one employee profile (department, job title, emergency contact)'];
            $items[] = ['id' => 'p4_leave_create', 'label' => 'Create a test leave request and approve or reject it'];
            $items[] = ['id' => 'p4_leave_policy', 'label' => 'Confirm default annual leave days match company policy'];
        }

        return $items;
    }

    /**
     * P5 quality & ops — smoke tests, monitoring, analytics.
     *
     * @return array{
     *   phase:string,
     *   ready:bool,
     *   summary:array{pass:int,warn:int,fail:int},
     *   checks:list<array<string,mixed>>,
     *   manual:list<array<string,mixed>>,
     *   analytics_enabled:bool
     * }
     */
    public static function evaluateP5(PDO $pdo, bool $p4Ready): array
    {
        $ops = OpsSettings::load($pdo);
        $checks = [];

        $checks[] = $p4Ready
            ? self::item('p4_prerequisite', 'P4 workforce ready', 'pass', 'Automated P4 checks passed (or HR off).', true, '/admin/launch-readiness')
            : self::item('p4_prerequisite', 'P4 workforce ready', 'fail', 'Complete P4 before enabling growth & ops tooling.', true, '/admin/launch-readiness');

        $hasOpsColumns = self::columnExists($pdo, 'company_settings', 'analytics_enabled');
        if ($hasOpsColumns) {
            $checks[] = self::item('ops_schema', 'Ops settings schema', 'pass', 'Migration 046 applied.', false, null);
        } else {
            $checks[] = self::item(
                'ops_schema',
                'Ops settings schema',
                'fail',
                'Run php backend/scripts/migrate-all.php (migration 046).',
                true,
                null
            );
        }

        $root = dirname(__DIR__, 2);
        $robotsOk = is_file($root . '/frontend/public/robots.txt');
        $sitemapOk = is_file($root . '/frontend/public/sitemap.xml');
        if ($robotsOk && $sitemapOk) {
            $checks[] = self::item('seo_files', 'SEO static files', 'pass', 'robots.txt and sitemap.xml present in frontend build.', false, null);
        } elseif ($robotsOk || $sitemapOk) {
            $missing = $robotsOk ? 'sitemap.xml' : 'robots.txt';
            $checks[] = self::item('seo_files', 'SEO static files', 'warn', "Missing {$missing} in frontend/public.", false, null);
        } else {
            $checks[] = self::item('seo_files', 'SEO static files', 'fail', 'Add robots.txt and sitemap.xml under frontend/public.', true, null);
        }

        $smokeScript = $root . '/backend/scripts/p5-smoke-test.php';
        if (is_file($smokeScript)) {
            $checks[] = self::item(
                'smoke_script',
                'P5 API smoke test',
                'pass',
                'Run php backend/scripts/p5-smoke-test.php after each deploy.',
                false,
                null
            );
        } else {
            $checks[] = self::item(
                'smoke_script',
                'P5 API smoke test',
                'fail',
                'Missing backend/scripts/p5-smoke-test.php.',
                true,
                null
            );
        }

        if (!$ops['analytics_enabled']) {
            $checks[] = self::item(
                'analytics',
                'Storefront analytics',
                'pass',
                'Analytics off — enable in Company settings when tracking traffic.',
                false,
                '/admin/company-settings'
            );
        } else {
            $gaId = $ops['google_analytics_id'];
            if (OpsSettings::isValidMeasurementId($gaId)) {
                $checks[] = self::item(
                    'analytics',
                    'Storefront analytics',
                    'pass',
                    "Google Analytics ID configured ({$gaId}).",
                    true,
                    '/admin/company-settings'
                );
            } else {
                $checks[] = self::item(
                    'analytics',
                    'Storefront analytics',
                    'fail',
                    'Set a valid GA4 measurement ID (G-XXXXXXXX) in Company settings.',
                    true,
                    '/admin/company-settings'
                );
            }
        }

        $sentry = trim((string) Env::get('SENTRY_DSN', ''));
        $isProd = Env::isProduction();
        if ($sentry !== '') {
            $checks[] = self::item('error_monitoring', 'Error monitoring (Sentry)', 'pass', 'SENTRY_DSN configured in API .env.', false, null);
        } elseif ($isProd) {
            $checks[] = self::item(
                'error_monitoring',
                'Error monitoring (Sentry)',
                'warn',
                'SENTRY_DSN not set — add for production error alerts or review PHP logs weekly.',
                false,
                null
            );
        } else {
            $checks[] = self::item(
                'error_monitoring',
                'Error monitoring (Sentry)',
                'pass',
                'Optional in dev — set SENTRY_DSN before production.',
                false,
                null
            );
        }

        $uptimeUrl = $ops['uptime_monitor_url'];
        if ($uptimeUrl !== null) {
            $checks[] = self::item(
                'uptime_monitor',
                'Uptime monitor URL',
                'pass',
                'Monitor link saved — confirm alerts are active.',
                false,
                '/admin/company-settings'
            );
        } elseif ($isProd) {
            $checks[] = self::item(
                'uptime_monitor',
                'Uptime monitor URL',
                'warn',
                'Save your UptimeRobot/Better Stack dashboard URL in Company settings for the team.',
                false,
                '/admin/company-settings'
            );
        } else {
            $checks[] = self::item(
                'uptime_monitor',
                'Uptime monitor URL',
                'pass',
                'Optional in dev — configure before wide public launch.',
                false,
                '/admin/company-settings'
            );
        }

        $pass = $warn = $fail = 0;
        foreach ($checks as $c) {
            match ($c['status']) {
                'pass' => $pass++,
                'warn' => $warn++,
                default => $fail++,
            };
        }

        $blocking = array_filter($checks, static fn (array $c): bool => ($c['blocking'] ?? false) && $c['status'] === 'fail');

        return [
            'phase'             => 'P5',
            'ready'             => $blocking === [],
            'summary'           => ['pass' => $pass, 'warn' => $warn, 'fail' => $fail],
            'checks'            => $checks,
            'manual'            => self::manualChecklistP5($ops['analytics_enabled']),
            'analytics_enabled' => $ops['analytics_enabled'],
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function manualChecklistP5(bool $analyticsEnabled): array
    {
        $items = [
            ['id' => 'p5_smoke', 'label' => 'Run php backend/scripts/p5-smoke-test.php against staging or production API'],
            ['id' => 'p5_uptime', 'label' => 'Uptime monitor pings /api/health every 5 minutes'],
            ['id' => 'p5_logs', 'label' => 'Review Paystack webhook failures and PHP error logs weekly'],
        ];

        if ($analyticsEnabled) {
            $items[] = ['id' => 'p5_ga_realtime', 'label' => 'Confirm GA4 Realtime shows a page_view after browsing the storefront'];
        }

        $items[] = ['id' => 'p5_checkout', 'label' => 'Repeat P1 checkout smoke test after major releases'];

        return $items;
    }

    private static function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $column]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private static function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
        );
        $stmt->execute([$table]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /** @return list<array<string,mixed>> */
    private static function manualChecklistP2(): array
    {
        return [
            ['id' => 'p2_backup', 'label' => 'Daily MySQL backup scheduled (Hostinger or external)'],
            ['id' => 'p2_uptime', 'label' => 'Uptime monitoring configured (optional free tier)'],
            ['id' => 'p2_domain', 'label' => 'Production domain + SSL verified on storefront and /api'],
            ['id' => 'p2_marketing', 'label' => 'No paid marketing until P2 automated checks pass'],
        ];
    }

    /** @return array<string,mixed> */
    private static function checkDatabase(PDO $pdo): array
    {
        try {
            $pdo->query('SELECT 1');
            return self::item('database', 'Database connection', 'pass', 'Connected.', false);
        } catch (\Throwable $e) {
            return self::item('database', 'Database connection', 'fail', $e->getMessage(), true, null);
        }
    }

    /** @return array<string,mixed> */
    private static function checkMigrations(PDO $pdo): array
    {
        $required = ['employees', 'job_posts', 'pickup_stations', 'delivery_runs', 'hero_banners', 'legal_policies', 'leave_requests'];
        $missing = [];
        foreach ($required as $table) {
            $stmt = $pdo->prepare(
                'SELECT COUNT(*) FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
            );
            $stmt->execute([$table]);
            if ((int) $stmt->fetchColumn() === 0) {
                $missing[] = $table;
            }
        }

        if ($missing === []) {
            return self::item('migrations', 'Schema migrations', 'pass', 'Core tables present (incl. H0/M2/M3/M7).', false);
        }

        return self::item(
            'migrations',
            'Schema migrations',
            'fail',
            'Missing tables: ' . implode(', ', $missing) . '. Run php backend/scripts/migrate-all.php',
            true,
            '/admin/company-settings'
        );
    }

    /** @return list<array<string,mixed>> */
    private static function checkCatalog(PDO $pdo): array
    {
        $active = (int) $pdo->query("SELECT COUNT(*) FROM products WHERE status = 'active'")->fetchColumn();
        $categories = (int) $pdo->query('SELECT COUNT(*) FROM categories WHERE parent_id IS NULL')->fetchColumn();

        $checks = [];
        if ($active >= self::MIN_PRODUCTS) {
            $checks[] = self::item(
                'products_min',
                'Active products',
                'pass',
                "{$active} active products (minimum " . self::MIN_PRODUCTS . ').',
                true,
                '/admin/products'
            );
        } elseif ($active > 0) {
            $checks[] = self::item(
                'products_min',
                'Active products',
                'fail',
                "Only {$active} active products — add at least " . self::MIN_PRODUCTS . ' for pilot.',
                true,
                '/admin/products'
            );
        } else {
            $checks[] = self::item(
                'products_min',
                'Active products',
                'fail',
                'No active products. Add catalog items before pilot orders.',
                true,
                '/admin/products'
            );
        }

        if ($categories >= 1) {
            $checks[] = self::item('categories', 'Categories', 'pass', "{$categories} top-level categories.", false, '/admin/categories');
        } else {
            $checks[] = self::item('categories', 'Categories', 'fail', 'No categories configured.', true, '/admin/categories');
        }

        return $checks;
    }

    /** @return list<array<string,mixed>> */
    private static function checkCompany(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT company_name, email, phone, whatsapp_support, address, business_hours, return_policy,
                        paystack_enabled, wallet_checkout_enabled
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable $e) {
            return [
                self::item(
                    'company_schema',
                    'Company settings schema',
                    'fail',
                    'Run php scripts/migrate-all.php (migration 008+). ' . $e->getMessage(),
                    true,
                    '/admin/company-settings'
                ),
            ];
        }

        if ($row === false) {
            return [self::item('company_row', 'Company settings', 'fail', 'No company_settings row.', true, '/admin/company-settings')];
        }

        $checks = [];
        $fields = [
            'phone'           => 'Phone number',
            'email'           => 'Support email',
            'address'         => 'Business address',
            'business_hours'  => 'Business hours',
            'whatsapp_support'=> 'WhatsApp support',
        ];

        foreach ($fields as $key => $label) {
            $val = trim((string) ($row[$key] ?? ''));
            if ($key === 'whatsapp_support') {
                if ($val !== '') {
                    $checks[] = self::item("company_{$key}", $label, 'pass', 'Set.', false, '/admin/company-settings');
                } else {
                    $checks[] = self::item("company_{$key}", $label, 'warn', 'Recommended for Ghana customers.', false, '/admin/company-settings');
                }
                continue;
            }
            if ($val !== '') {
                $checks[] = self::item("company_{$key}", $label, 'pass', 'Set.', true, '/admin/company-settings');
            } else {
                $checks[] = self::item("company_{$key}", $label, 'fail', 'Required for pilot — fill in Company settings.', true, '/admin/company-settings');
            }
        }

        $publishedPolicies = 0;
        try {
            $publishedPolicies = LegalPolicyService::countPublished($pdo);
        } catch (\Throwable) {
            $publishedPolicies = 0;
        }

        if ($publishedPolicies >= 1) {
            $checks[] = self::item(
                'legal_policies',
                'Legal policies',
                'pass',
                "{$publishedPolicies} published policy(ies) — manage under Legal policies.",
                true,
                '/admin/legal-policies'
            );
        } else {
            $legacyReturns = trim((string) ($row['return_policy'] ?? ''));
            if (strlen($legacyReturns) >= 40) {
                $checks[] = self::item(
                    'legal_policies',
                    'Legal policies',
                    'warn',
                    'Using legacy return text in company settings — add policies in Legal policies admin.',
                    false,
                    '/admin/legal-policies'
                );
            } else {
                $checks[] = self::item(
                    'legal_policies',
                    'Legal policies',
                    'fail',
                    'Publish at least one legal policy (e.g. returns).',
                    true,
                    '/admin/legal-policies'
                );
            }
        }

        $activeHero = 0;
        try {
            $activeHero = count(HeroBannerService::listActive($pdo));
        } catch (\Throwable) {
            $activeHero = 0;
        }
        if ($activeHero >= 1) {
            $checks[] = self::item('hero_banners', 'Homepage hero', 'pass', "{$activeHero} active slide(s).", false, '/admin/hero-banners');
        } else {
            $checks[] = self::item('hero_banners', 'Homepage hero', 'warn', 'No active hero banners.', false, '/admin/hero-banners');
        }

        $paystackOn = (int) ($row['paystack_enabled'] ?? 1) === 1;
        $checks[] = $paystackOn
            ? self::item('checkout_paystack', 'Paystack checkout', 'pass', 'Enabled in company settings.', true, '/admin/company-settings')
            : self::item('checkout_paystack', 'Paystack checkout', 'fail', 'Enable Paystack for card/MoMo payments.', true, '/admin/company-settings');

        return $checks;
    }

    /** @return array<string,mixed> */
    private static function checkShipping(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT local_delivery_base_percent FROM shipping_settings ORDER BY id DESC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return self::item('shipping', 'Shipping settings', 'fail', 'shipping_settings table missing.', true, '/admin/shipping');
        }

        if ($row === false) {
            return self::item('shipping', 'Shipping settings', 'fail', 'No shipping row — configure local delivery %.', true, '/admin/shipping');
        }

        $pct = (float) ($row['local_delivery_base_percent'] ?? 0);
        if ($pct >= 0) {
            return self::item('shipping', 'Shipping settings', 'pass', "Local delivery base: {$pct}%.", true, '/admin/shipping');
        }

        return self::item('shipping', 'Shipping settings', 'warn', 'Review shipping percentage for pilot.', false, '/admin/shipping');
    }

    /** @return list<array<string,mixed>> */
    private static function checkPayments(PDO $pdo): array
    {
        $checks = [];
        $secret = trim((string) Env::get('PAYSTACK_SECRET_KEY', ''));
        $isProd = Env::isProduction();

        if ($secret === '' || str_contains($secret, 'xxxxxxxx')) {
            $checks[] = self::item('paystack_env', 'Paystack secret key', 'fail', 'Set PAYSTACK_SECRET_KEY in API .env.', true, null);
        } elseif ($isProd && str_starts_with($secret, 'sk_test_')) {
            $checks[] = self::item('paystack_env', 'Paystack secret key', 'fail', 'Production must use sk_live_ key.', true, null);
        } else {
            $mode = str_starts_with($secret, 'sk_live_') ? 'live' : 'test';
            $checks[] = self::item('paystack_env', 'Paystack secret key', 'pass', "Key configured ({$mode} mode).", true, null);
        }

        $smtp = trim((string) Env::get('SMTP_HOST', ''));
        if ($smtp === '') {
            $checks[] = self::item('smtp', 'Email (SMTP)', 'warn', 'SMTP_HOST empty — password reset emails may not send.', false, null);
        } else {
            $checks[] = self::item('smtp', 'Email (SMTP)', 'pass', 'SMTP configured.', false, null);
        }

        if ($isProd) {
            $bypass = strtolower(trim((string) Env::get('DEV_ADMIN_BYPASS', '0')));
            if (in_array($bypass, ['1', 'true', 'yes', 'on'], true)) {
                $checks[] = self::item('dev_bypass', 'Dev admin bypass', 'fail', 'DEV_ADMIN_BYPASS must be off in production.', true, null);
            } else {
                $checks[] = self::item('dev_bypass', 'Dev admin bypass', 'pass', 'Disabled.', false, null);
            }
        }

        return $checks;
    }

    /** @return list<array<string,mixed>> */
    private static function checkModules(PDO $pdo): array
    {
        $flags = PlatformFeatures::load($pdo);
        $enabled = [];
        foreach ($flags as $k => $v) {
            if ($v) {
                $enabled[] = str_replace('_', ' ', $k);
            }
        }

        $msg = $enabled === []
            ? 'Only core store toggles on — good for first pilot.'
            : 'Enabled: ' . implode(', ', $enabled) . '. Confirm you can operate these.';

        return [
            self::item('modules', 'Platform modules', 'warn', $msg, false, '/admin/company-settings'),
        ];
    }

    /** @return array<string,mixed> */
    private static function checkOrdersPilot(PDO $pdo): array
    {
        $paid = (int) $pdo->query(
            "SELECT COUNT(*) FROM orders WHERE status IN ('payment_confirmed','processing','shipped','delivered','ready_for_pickup','collected')"
        )->fetchColumn();

        if ($paid >= 3) {
            return self::item('orders_pilot', 'Paid orders (pilot goal)', 'pass', "{$paid} fulfilled/paid orders — P1 pilot goal met.", false, '/admin/orders');
        }
        if ($paid >= 1) {
            return self::item('orders_pilot', 'Paid orders (pilot goal)', 'warn', "{$paid} paid order(s) — aim for 3+ pilot orders without DB edits.", false, '/admin/orders');
        }

        return self::item('orders_pilot', 'Paid orders (pilot goal)', 'warn', 'No paid orders yet — run a small live test payment.', false, '/admin/orders');
    }

    /** @return list<array<string,mixed>> */
    private static function manualChecklist(): array
    {
        return [
            ['id' => 'flow_register', 'label' => 'Customer can register and verify email'],
            ['id' => 'flow_checkout', 'label' => 'Test checkout with small live MoMo or card payment'],
            ['id' => 'flow_webhook', 'label' => 'Paystack webhook marks order paid in admin'],
            ['id' => 'flow_admin_order', 'label' => 'Admin can update order status end-to-end'],
            ['id' => 'flow_shipping_quote', 'label' => 'Shipping quote looks correct at checkout'],
            ['id' => 'flow_password_email', 'label' => 'Password reset email received (if SMTP on)'],
        ];
    }

    /** @return array<string,mixed> */
    private static function stats(PDO $pdo): array
    {
        return [
            'products_active' => (int) $pdo->query("SELECT COUNT(*) FROM products WHERE status = 'active'")->fetchColumn(),
            'orders_paid'     => (int) $pdo->query(
                "SELECT COUNT(*) FROM orders WHERE status NOT IN ('placed','pending_payment','cancelled')"
            )->fetchColumn(),
            'app_env'         => Env::get('APP_ENV', 'dev'),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private static function item(
        string $id,
        string $label,
        string $status,
        string $message,
        bool $blocking,
        ?string $fixTo = null
    ): array {
        return [
            'id'       => $id,
            'label'    => $label,
            'status'   => $status,
            'message'  => $message,
            'blocking' => $blocking && $status === 'fail',
            'fix_to'   => $fixTo,
        ];
    }
}
