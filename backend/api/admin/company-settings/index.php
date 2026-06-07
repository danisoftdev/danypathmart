<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ClubLoyaltyService;
use App\Helpers\PlatformFeatures;
use App\Helpers\ReferralService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$pdo = Database::pdo();
$row = false;
try {
    $row = $pdo->query(
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
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
} catch (\Throwable) {
    $row = $pdo->query(
        'SELECT id, company_name, email, phone, whatsapp_group, whatsapp_support,
                facebook, instagram, twitter, address, business_hours,
                return_policy, paystack_enabled, wallet_checkout_enabled,
                bank_transfer_enabled, pod_enabled, pay_before_delivery,
                bank_name, bank_account_name, bank_account_number,
                exchange_enabled, exchange_within_days, exchange_policy_note,
                quotes_enabled, institutional_pay_later_enabled,
                usd_to_ghs_rate, updated_by, updated_at
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
}

$clubDefaults = ClubLoyaltyService::settings($pdo);
$referralDefaults = ReferralService::settings($pdo);

$settings = $row !== false ? [
    'id'                       => (int) $row['id'],
    'company_name'             => $row['company_name'],
    'email'                    => $row['email'],
    'phone'                    => $row['phone'],
    'whatsapp_group'           => $row['whatsapp_group'],
    'whatsapp_support'         => $row['whatsapp_support'],
    'facebook'                 => $row['facebook'],
    'instagram'                => $row['instagram'],
    'twitter'                  => $row['twitter'],
    'address'                  => $row['address'],
    'business_hours'           => $row['business_hours'],
    'return_policy'            => $row['return_policy'],
    'paystack_enabled'         => (bool) ($row['paystack_enabled'] ?? 1),
    'wallet_checkout_enabled'  => (bool) ($row['wallet_checkout_enabled'] ?? 0),
    'bank_transfer_enabled'    => (bool) ($row['bank_transfer_enabled'] ?? 0),
    'pod_enabled'              => (bool) ($row['pod_enabled'] ?? 0),
    'pay_before_delivery'      => (bool) ($row['pay_before_delivery'] ?? 1),
    'bank_name'                => $row['bank_name'] ?? null,
    'bank_account_name'        => $row['bank_account_name'] ?? null,
    'bank_account_number'      => $row['bank_account_number'] ?? null,
    'exchange_enabled'         => (bool) ($row['exchange_enabled'] ?? 1),
    'exchange_within_days'     => max(1, (int) ($row['exchange_within_days'] ?? 7)),
    'exchange_policy_note'     => $row['exchange_policy_note'] ?? null,
    'quotes_enabled'           => (bool) ($row['quotes_enabled'] ?? 1),
    'institutional_pay_later_enabled' => (bool) ($row['institutional_pay_later_enabled'] ?? 1),
    'usd_to_ghs_rate'          => (float) $row['usd_to_ghs_rate'],
    'updated_at'               => $row['updated_at'],
    'repeat_club_discount_enabled'  => (bool) ($row['repeat_club_discount_enabled'] ?? $clubDefaults['enabled']),
    'repeat_club_discount_mode'     => (string) ($row['repeat_club_discount_mode'] ?? $clubDefaults['mode']),
    'repeat_club_discount_percent'  => (float) ($row['repeat_club_discount_percent'] ?? $clubDefaults['percent']),
    'referral_credit_enabled'       => (bool) ($row['referral_credit_enabled'] ?? $referralDefaults['enabled']),
    'referral_credit_amount'        => (float) ($row['referral_credit_amount'] ?? $referralDefaults['amount']),
    'weekly_orders_export_enabled'  => (bool) ($row['weekly_orders_export_enabled'] ?? 0),
    'weekly_orders_export_email'    => $row['weekly_orders_export_email'] ?? null,
    'weekly_orders_export_last_sent'=> $row['weekly_orders_export_last_sent'] ?? null,
] : [
    'company_name'             => 'DanyPathMart',
    'email'                    => null,
    'phone'                    => null,
    'whatsapp_group'           => null,
    'whatsapp_support'         => null,
    'facebook'                 => null,
    'instagram'                => null,
    'twitter'                  => null,
    'address'                  => null,
    'business_hours'           => null,
    'return_policy'            => null,
    'paystack_enabled'         => true,
    'wallet_checkout_enabled'  => false,
    'bank_transfer_enabled'    => false,
    'pod_enabled'              => false,
    'pay_before_delivery'      => true,
    'exchange_enabled'         => true,
    'exchange_within_days'     => 7,
    'exchange_policy_note'     => null,
    'quotes_enabled'           => true,
    'institutional_pay_later_enabled' => true,
    'usd_to_ghs_rate'          => 0.0,
    'updated_at'               => null,
    'repeat_club_discount_enabled'  => false,
    'repeat_club_discount_mode'     => 'percent',
    'repeat_club_discount_percent'  => 5.0,
    'referral_credit_enabled'       => false,
    'referral_credit_amount'        => 10.0,
    'weekly_orders_export_enabled'  => false,
    'weekly_orders_export_email'    => null,
    'weekly_orders_export_last_sent'=> null,
];

$settings = array_merge($settings, PlatformFeatures::load($pdo));

try {
    $m4 = $pdo->query(
        'SELECT default_shop_commission_percent, shop_earnings_release_on FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
    if ($m4 !== false) {
        $settings['default_shop_commission_percent'] = (float) ($m4['default_shop_commission_percent'] ?? 10);
        $settings['shop_earnings_release_on'] = (string) ($m4['shop_earnings_release_on'] ?? 'collected');
    }
} catch (\Throwable) {
    $settings['default_shop_commission_percent'] = 10.0;
    $settings['shop_earnings_release_on'] = 'collected';
}

try {
    $m5 = $pdo->query(
        'SELECT shop_referral_bonus_amount, shop_referral_sales_target, shop_referral_count_on
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
    if ($m5 !== false) {
        $settings['shop_referral_bonus_amount'] = (float) ($m5['shop_referral_bonus_amount'] ?? 50);
        $settings['shop_referral_sales_target'] = max(1, (int) ($m5['shop_referral_sales_target'] ?? 10));
        $settings['shop_referral_count_on'] = ($m5['shop_referral_count_on'] ?? 'collected') === 'paid' ? 'paid' : 'collected';
    }
} catch (\Throwable) {
    $settings['shop_referral_bonus_amount'] = 50.0;
    $settings['shop_referral_sales_target'] = 10;
    $settings['shop_referral_count_on'] = 'collected';
}

try {
    $hr = $pdo->query(
        'SELECT leave_requests_enabled, default_annual_leave_days FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
    if ($hr !== false) {
        $settings['leave_requests_enabled'] = (int) ($hr['leave_requests_enabled'] ?? 0) === 1;
        $settings['default_annual_leave_days'] = max(1, (int) ($hr['default_annual_leave_days'] ?? 21));
    }
} catch (\Throwable) {
    $settings['leave_requests_enabled'] = false;
    $settings['default_annual_leave_days'] = 21;
}

try {
    $ops = $pdo->query(
        'SELECT analytics_enabled, google_analytics_id, uptime_monitor_url FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
    if ($ops !== false) {
        $settings['analytics_enabled'] = (int) ($ops['analytics_enabled'] ?? 0) === 1;
        $settings['google_analytics_id'] = $ops['google_analytics_id'] ?? null;
        $settings['uptime_monitor_url'] = $ops['uptime_monitor_url'] ?? null;
    }
} catch (\Throwable) {
    $settings['analytics_enabled'] = false;
    $settings['google_analytics_id'] = null;
    $settings['uptime_monitor_url'] = null;
}

try {
    $billing = \App\Helpers\ShopBillingService::loadSettings($pdo);
    $settings['shop_billing_enabled'] = $billing['shop_billing_enabled'];
    $settings['shop_registration_fee_ghs'] = $billing['shop_registration_fee_ghs'];
    $settings['shop_renewal_fee_ghs'] = $billing['shop_renewal_fee_ghs'];
    $settings['shop_renewal_period'] = $billing['shop_renewal_period'];
    $settings['shop_renewal_grace_days'] = $billing['shop_renewal_grace_days'];
} catch (\Throwable) {
    $settings['shop_billing_enabled'] = false;
    $settings['shop_registration_fee_ghs'] = 0.0;
    $settings['shop_renewal_fee_ghs'] = 0.0;
    $settings['shop_renewal_period'] = 'yearly';
    $settings['shop_renewal_grace_days'] = 7;
}

Response::success(['settings' => $settings]);
