<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Loads admin company settings with graceful fallbacks when migrations are partial. */
final class CompanySettingsService
{
    /**
     * @return array<string,mixed>
     */
    public static function loadForAdmin(PDO $pdo): array
    {
        $clubDefaults = ClubLoyaltyService::settings($pdo);
        $referralDefaults = ReferralService::settings($pdo);
        $row = self::fetchBaseRow($pdo);

        $settings = $row !== false ? self::mapBaseRow($row, $clubDefaults, $referralDefaults) : self::defaultRow();

        $settings = array_merge($settings, PlatformFeatures::load($pdo));
        $settings = array_merge($settings, self::loadMarketplace($pdo));
        $settings = array_merge($settings, self::loadHr($pdo));
        $settings = array_merge($settings, self::loadOps($pdo));
        $settings = array_merge($settings, self::loadImageSearch($pdo));
        $settings = array_merge($settings, self::loadSubscriptionReferral($pdo));
        $settings = array_merge($settings, self::loadShopBilling($pdo));
        $settings = array_merge($settings, self::loadLocation($pdo));

        return $settings;
    }

    /**
     * @return array<string,mixed>|false
     */
    private static function fetchBaseRow(PDO $pdo): array|false
    {
        $queries = [
            'SELECT id, company_name, email, phone, whatsapp_group, whatsapp_support,
                    facebook, instagram, twitter, address, business_hours,
                    return_policy, paystack_enabled, wallet_checkout_enabled,
                    bank_transfer_enabled, pod_enabled, pay_before_delivery,
                    bank_name, bank_account_name, bank_account_number,
                    exchange_enabled, exchange_within_days, exchange_policy_note,
                    quotes_enabled, institutional_pay_later_enabled,
                    repeat_club_discount_enabled, repeat_club_discount_mode, repeat_club_discount_percent,
                    referral_credit_enabled, referral_credit_amount,
                    weekly_orders_export_enabled, weekly_orders_export_email, weekly_orders_export_last_sent,
                    usd_to_ghs_rate, updated_by, updated_at
             FROM company_settings ORDER BY id ASC LIMIT 1',
            'SELECT id, company_name, email, phone, whatsapp_group, whatsapp_support,
                    facebook, instagram, twitter, address, business_hours,
                    return_policy, paystack_enabled, wallet_checkout_enabled,
                    bank_transfer_enabled, pod_enabled, pay_before_delivery,
                    bank_name, bank_account_name, bank_account_number,
                    exchange_enabled, exchange_within_days, exchange_policy_note,
                    quotes_enabled, institutional_pay_later_enabled,
                    usd_to_ghs_rate, updated_by, updated_at
             FROM company_settings ORDER BY id ASC LIMIT 1',
            'SELECT id, company_name, email, phone, whatsapp_group, whatsapp_support,
                    facebook, instagram, twitter, address, business_hours,
                    return_policy, usd_to_ghs_rate, updated_by, updated_at
             FROM company_settings ORDER BY id ASC LIMIT 1',
        ];

        foreach ($queries as $sql) {
            try {
                $row = $pdo->query($sql)->fetch();
                if ($row !== false) {
                    return $row;
                }
            } catch (\Throwable) {
                continue;
            }
        }

        return false;
    }

    /**
     * @param array<string,mixed> $row
     * @param array<string,mixed> $clubDefaults
     * @param array<string,mixed> $referralDefaults
     * @return array<string,mixed>
     */
    private static function mapBaseRow(array $row, array $clubDefaults, array $referralDefaults): array
    {
        return [
            'id'                              => (int) $row['id'],
            'company_name'                    => $row['company_name'],
            'email'                           => $row['email'],
            'phone'                           => $row['phone'],
            'whatsapp_group'                  => $row['whatsapp_group'],
            'whatsapp_support'                => $row['whatsapp_support'],
            'facebook'                        => $row['facebook'],
            'instagram'                       => $row['instagram'],
            'twitter'                         => $row['twitter'],
            'address'                         => $row['address'],
            'business_hours'                  => $row['business_hours'],
            'return_policy'                   => $row['return_policy'],
            'paystack_enabled'                => (bool) ($row['paystack_enabled'] ?? 1),
            'wallet_checkout_enabled'         => (bool) ($row['wallet_checkout_enabled'] ?? 0),
            'bank_transfer_enabled'           => (bool) ($row['bank_transfer_enabled'] ?? 0),
            'pod_enabled'                     => (bool) ($row['pod_enabled'] ?? 0),
            'pay_before_delivery'             => (bool) ($row['pay_before_delivery'] ?? 1),
            'bank_name'                       => $row['bank_name'] ?? null,
            'bank_account_name'               => $row['bank_account_name'] ?? null,
            'bank_account_number'             => $row['bank_account_number'] ?? null,
            'exchange_enabled'                => (bool) ($row['exchange_enabled'] ?? 1),
            'exchange_within_days'            => max(1, (int) ($row['exchange_within_days'] ?? 7)),
            'exchange_policy_note'            => $row['exchange_policy_note'] ?? null,
            'quotes_enabled'                  => (bool) ($row['quotes_enabled'] ?? 1),
            'institutional_pay_later_enabled' => (bool) ($row['institutional_pay_later_enabled'] ?? 1),
            'usd_to_ghs_rate'                 => (float) $row['usd_to_ghs_rate'],
            'updated_at'                      => $row['updated_at'],
            'repeat_club_discount_enabled'    => (bool) ($row['repeat_club_discount_enabled'] ?? $clubDefaults['enabled']),
            'repeat_club_discount_mode'       => (string) ($row['repeat_club_discount_mode'] ?? $clubDefaults['mode']),
            'repeat_club_discount_percent'    => (float) ($row['repeat_club_discount_percent'] ?? $clubDefaults['percent']),
            'referral_credit_enabled'         => (bool) ($row['referral_credit_enabled'] ?? $referralDefaults['enabled']),
            'referral_credit_amount'          => (float) ($row['referral_credit_amount'] ?? $referralDefaults['amount']),
            'weekly_orders_export_enabled'    => (bool) ($row['weekly_orders_export_enabled'] ?? 0),
            'weekly_orders_export_email'      => $row['weekly_orders_export_email'] ?? null,
            'weekly_orders_export_last_sent'  => $row['weekly_orders_export_last_sent'] ?? null,
        ];
    }

    /** @return array<string,mixed> */
    private static function defaultRow(): array
    {
        return [
            'company_name'                    => 'DanyPathMart',
            'email'                           => null,
            'phone'                           => null,
            'whatsapp_group'                  => null,
            'whatsapp_support'                => null,
            'facebook'                        => null,
            'instagram'                       => null,
            'twitter'                         => null,
            'address'                         => null,
            'business_hours'                  => null,
            'return_policy'                   => null,
            'paystack_enabled'                => true,
            'wallet_checkout_enabled'         => false,
            'bank_transfer_enabled'           => false,
            'pod_enabled'                     => false,
            'pay_before_delivery'             => true,
            'exchange_enabled'                => true,
            'exchange_within_days'            => 7,
            'exchange_policy_note'            => null,
            'quotes_enabled'                  => true,
            'institutional_pay_later_enabled' => true,
            'usd_to_ghs_rate'                 => 0.0,
            'updated_at'                      => null,
            'repeat_club_discount_enabled'    => false,
            'repeat_club_discount_mode'       => 'percent',
            'repeat_club_discount_percent'    => 5.0,
            'referral_credit_enabled'         => false,
            'referral_credit_amount'          => 10.0,
            'weekly_orders_export_enabled'    => false,
            'weekly_orders_export_email'      => null,
            'weekly_orders_export_last_sent'  => null,
        ];
    }

    /** @return array<string,mixed> */
    private static function loadMarketplace(PDO $pdo): array
    {
        $out = [
            'default_shop_commission_percent' => 10.0,
            'shop_earnings_release_on'        => 'collected',
            'shop_referral_bonus_amount'      => 50.0,
            'shop_referral_sales_target'      => 10,
            'shop_referral_count_on'          => 'collected',
        ];

        try {
            $m4 = $pdo->query(
                'SELECT default_shop_commission_percent, shop_earnings_release_on FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($m4 !== false) {
                $out['default_shop_commission_percent'] = (float) ($m4['default_shop_commission_percent'] ?? 10);
                $out['shop_earnings_release_on'] = (string) ($m4['shop_earnings_release_on'] ?? 'collected');
            }
        } catch (\Throwable) {
        }

        try {
            $m5 = $pdo->query(
                'SELECT shop_referral_bonus_amount, shop_referral_sales_target, shop_referral_count_on
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($m5 !== false) {
                $out['shop_referral_bonus_amount'] = (float) ($m5['shop_referral_bonus_amount'] ?? 50);
                $out['shop_referral_sales_target'] = max(1, (int) ($m5['shop_referral_sales_target'] ?? 10));
                $out['shop_referral_count_on'] = ($m5['shop_referral_count_on'] ?? 'collected') === 'paid' ? 'paid' : 'collected';
            }
        } catch (\Throwable) {
        }

        return $out;
    }

    /** @return array<string,mixed> */
    private static function loadHr(PDO $pdo): array
    {
        try {
            $hr = $pdo->query(
                'SELECT leave_requests_enabled, default_annual_leave_days FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($hr !== false) {
                return [
                    'leave_requests_enabled'      => (int) ($hr['leave_requests_enabled'] ?? 0) === 1,
                    'default_annual_leave_days' => max(1, (int) ($hr['default_annual_leave_days'] ?? 21)),
                ];
            }
        } catch (\Throwable) {
        }

        return ['leave_requests_enabled' => false, 'default_annual_leave_days' => 21];
    }

    /** @return array<string,mixed> */
    private static function loadOps(PDO $pdo): array
    {
        try {
            $ops = $pdo->query(
                'SELECT analytics_enabled, google_analytics_id, uptime_monitor_url FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($ops !== false) {
                return [
                    'analytics_enabled'    => (int) ($ops['analytics_enabled'] ?? 0) === 1,
                    'google_analytics_id'  => $ops['google_analytics_id'] ?? null,
                    'uptime_monitor_url'   => $ops['uptime_monitor_url'] ?? null,
                ];
            }
        } catch (\Throwable) {
        }

        return [
            'analytics_enabled'   => false,
            'google_analytics_id' => null,
            'uptime_monitor_url'  => null,
        ];
    }

    /** @return array<string,mixed> */
    private static function loadImageSearch(PDO $pdo): array
    {
        $enabled = false;
        try {
            $vision = $pdo->query(
                'SELECT image_search_enabled FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($vision !== false) {
                $enabled = (int) ($vision['image_search_enabled'] ?? 0) === 1;
            }
        } catch (\Throwable) {
        }

        $configured = false;
        try {
            $configured = class_exists(ImageSearchService::class) && ImageSearchService::isConfigured();
        } catch (\Throwable) {
        }

        return [
            'image_search_enabled'   => $enabled,
            'vision_api_configured'  => $configured,
        ];
    }

    /** @return array<string,mixed> */
    private static function loadSubscriptionReferral(PDO $pdo): array
    {
        $defaults = ['subscription_referral_percent' => 15.0, 'subscription_referral_sources' => 'both'];
        try {
            $row = $pdo->query(
                'SELECT subscription_referral_percent, subscription_referral_sources FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($row !== false) {
                $defaults['subscription_referral_percent'] = max(0.0, min(100.0, (float) ($row['subscription_referral_percent'] ?? 15)));
                $src = (string) ($row['subscription_referral_sources'] ?? 'both');
                $defaults['subscription_referral_sources'] = in_array($src, ['both', 'promoter', 'shop'], true) ? $src : 'both';
            }
        } catch (\Throwable) {
        }

        return $defaults;
    }

    /** @return array<string,mixed> */
    private static function loadShopBilling(PDO $pdo): array
    {
        try {
            return ShopBillingService::loadSettings($pdo);
        } catch (\Throwable) {
            return [
                'shop_billing_enabled'      => false,
                'shop_registration_fee_ghs' => 0.0,
                'shop_renewal_fee_ghs'      => 0.0,
                'shop_renewal_period'       => 'yearly',
                'shop_renewal_grace_days'   => 7,
            ];
        }
    }

    /** @return array<string,mixed> */
    private static function loadLocation(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT latitude, longitude FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($row === false) {
                return self::defaultLocation();
            }
            $lat = LocationHelper::parseCoordinate($row['latitude'] ?? null);
            $lng = LocationHelper::parseCoordinate($row['longitude'] ?? null);

            return [
                'latitude'       => $lat,
                'longitude'      => $lng,
                'has_map_pin'    => LocationHelper::hasPin($lat, $lng),
                'directions_url' => LocationHelper::hasPin($lat, $lng)
                    ? LocationHelper::googleDirectionsUrl($lat, $lng)
                    : null,
            ];
        } catch (\Throwable) {
            return self::defaultLocation();
        }
    }

    /** @return array<string,mixed> */
    private static function defaultLocation(): array
    {
        return [
            'latitude'       => null,
            'longitude'      => null,
            'has_map_pin'    => false,
            'directions_url' => null,
        ];
    }
}
