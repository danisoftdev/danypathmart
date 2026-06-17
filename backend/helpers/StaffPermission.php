<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Database;

/**
 * Canonical RBAC permission keys and helpers for resolving a user's effective
 * permission set. super_admin implicitly holds every permission.
 */
final class StaffPermission
{
    /** All permission keys, in display order. */
    public const KEYS = [
        'view_orders',
        'edit_orders',
        'view_quotes',
        'edit_quotes',
        'view_products',
        'add_edit_products',
        'delete_products',
        'manage_categories',
        'manage_size_guides',
        'manage_kits',
        'manage_flash_sale',
        'view_hero_banners',
        'manage_hero_banners',
        'view_legal_policies',
        'manage_legal_policies',
        'view_users',
        'edit_users',
        'send_notifications',
        'manage_staff',
        'hire_employees',
        'manage_position_permissions',
        'view_company_settings',
        'edit_company_settings',
        'manage_shipping',
        'manage_pickup_stations',
        'manage_hub_logistics',
        'manage_delivery_runs',
        'manage_station_staff',
        'manage_marketplace',
        'approve_shop_listings',
        'view_shop_billing',
        'manage_shop_fees',
        'waive_shop_fees',
        'manage_contact_inbox',
        'manage_careers',
        'view_reports',
        'export_reports',
        'view_image_alerts',
        'manage_image_alerts',
        'manage_image_search',
        'manage_custom_proofs',
        'view_employees',
        'manage_employee_profiles',
        'view_leave_requests',
        'manage_leave_requests',
    ];

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            'view_orders'                 => 'View orders',
            'edit_orders'                 => 'Edit orders & update status',
            'view_quotes'                 => 'View quotes',
            'edit_quotes'                 => 'Approve / reject quotes',
            'view_products'               => 'View products',
            'add_edit_products'           => 'Add & edit products',
            'delete_products'             => 'Delete products',
            'manage_categories'           => 'Manage categories',
            'manage_size_guides'          => 'Manage size guides',
            'manage_kits'                 => 'Manage kit templates',
            'manage_flash_sale'           => 'Manage flash sale',
            'view_hero_banners'           => 'View homepage hero banners',
            'manage_hero_banners'         => 'Manage homepage hero banners',
            'view_legal_policies'         => 'View legal policies',
            'manage_legal_policies'       => 'Manage legal policies',
            'view_users'                  => 'View customers',
            'edit_users'                  => 'Edit customers',
            'send_notifications'          => 'Send broadcast notifications',
            'manage_staff'                => 'Manage staff accounts',
            'hire_employees'              => 'Hire from applications & create logins',
            'manage_position_permissions' => 'Edit default permissions per position',
            'view_company_settings'       => 'View company settings',
            'edit_company_settings'       => 'Edit company settings',
            'manage_shipping'             => 'Manage shipping settings',
            'manage_pickup_stations'      => 'Manage pickup stations',
            'manage_hub_logistics'        => 'Hub receive & station handoff',
            'manage_delivery_runs'        => 'Delivery runs & drivers',
            'manage_station_staff'        => 'Station staff & repack accounts',
            'manage_marketplace'          => 'Manage marketplace & shops',
            'approve_shop_listings'       => 'Approve shop product listings',
            'view_shop_billing'           => 'View shop registration & renewal payments',
            'manage_shop_fees'            => 'Set shop registration fee & renewal (month/year)',
            'waive_shop_fees'             => 'Waive shop fees & grant billing extensions',
            'manage_contact_inbox'        => 'Contact inbox',
            'manage_careers'              => 'Careers, job posts & applications',
            'view_reports'                => 'View reports',
            'export_reports'              => 'Export reports & data',
            'view_image_alerts'           => 'View image alerts',
            'manage_image_alerts'         => 'Manage image alerts',
            'manage_image_search'         => 'Enable image search (Google Vision)',
            'manage_custom_proofs'        => 'Custom proof approvals',
            'view_employees'              => 'View employee profiles',
            'manage_employee_profiles'    => 'Manage employee profiles',
            'view_leave_requests'         => 'View leave requests',
            'manage_leave_requests'       => 'Manage leave requests',
        ];
    }

    /** @return list<array{title:string,keys:list<string>}> */
    public static function groups(): array
    {
        return [
            ['title' => 'Orders', 'keys' => ['view_orders', 'edit_orders']],
            ['title' => 'Quotes', 'keys' => ['view_quotes', 'edit_quotes']],
            [
                'title' => 'Products & catalogue',
                'keys'  => [
                    'view_products', 'add_edit_products', 'delete_products',
                    'manage_categories', 'manage_size_guides', 'manage_kits', 'manage_flash_sale',
                ],
            ],
            [
                'title' => 'Customers & comms',
                'keys'  => ['view_users', 'edit_users', 'send_notifications', 'manage_contact_inbox'],
            ],
            [
                'title' => 'Staff & hiring',
                'keys'  => [
                    'manage_staff', 'hire_employees', 'manage_position_permissions',
                    'view_employees', 'manage_employee_profiles',
                    'view_leave_requests', 'manage_leave_requests',
                ],
            ],
            [
                'title' => 'Careers',
                'keys'  => ['manage_careers'],
            ],
            [
                'title' => 'Marketplace',
                'keys'  => [
                    'manage_marketplace', 'approve_shop_listings',
                    'view_shop_billing', 'manage_shop_fees', 'waive_shop_fees',
                ],
            ],
            [
                'title' => 'Storefront content',
                'keys'  => [
                    'view_hero_banners', 'manage_hero_banners',
                    'view_legal_policies', 'manage_legal_policies',
                ],
            ],
            [
                'title' => 'Company & shipping',
                'keys'  => [
                    'view_company_settings', 'edit_company_settings', 'manage_shipping',
                    'manage_pickup_stations', 'manage_hub_logistics', 'manage_delivery_runs',
                    'manage_station_staff',
                ],
            ],
            ['title' => 'Reports & exports', 'keys' => ['view_reports', 'export_reports']],
            ['title' => 'Image search & alerts', 'keys' => ['manage_image_search', 'view_image_alerts', 'manage_image_alerts']],
            ['title' => 'Custom proofs', 'keys' => ['manage_custom_proofs']],
        ];
    }

    /** @return array{keys:list<string>,labels:array<string,string>,groups:list<array{title:string,keys:list<string>}>} */
    public static function catalog(): array
    {
        return [
            'keys'   => self::KEYS,
            'labels' => self::labels(),
            'groups' => self::groups(),
        ];
    }

    /**
     * @return array<string,bool>
     */
    public static function defaults(bool $value = false): array
    {
        return array_fill_keys(self::KEYS, $value);
    }

    public static function getForUser(int $userId): ?string
    {
        $stmt = Database::pdo()->prepare('SELECT permissions FROM staff_permissions WHERE user_id = ?');
        $stmt->execute([$userId]);
        $value = $stmt->fetchColumn();
        return $value === false ? null : (string) $value;
    }

    /**
     * @return array<string,bool>
     */
    public static function effective(int $userId, string $role): array
    {
        if ($role === 'super_admin') {
            return self::defaults(true);
        }

        $json = self::getForUser($userId);
        $stored = $json !== null ? json_decode($json, true) : [];
        if (!is_array($stored)) {
            $stored = [];
        }

        $out = self::defaults(false);
        foreach (self::KEYS as $key) {
            $out[$key] = !empty($stored[$key]);
        }
        return $out;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,bool>
     */
    public static function sanitize(array $input): array
    {
        $out = self::defaults(false);
        foreach (self::KEYS as $key) {
            $out[$key] = !empty($input[$key]);
        }
        return $out;
    }

    /** super_admin or holder of any listed permission. */
    public static function userHasAny(int $userId, string $role, array $permissions): bool
    {
        if ($role === 'super_admin') {
            return true;
        }
        $effective = self::effective($userId, $role);
        foreach ($permissions as $perm) {
            if (!empty($effective[$perm])) {
                return true;
            }
        }
        return false;
    }
}
