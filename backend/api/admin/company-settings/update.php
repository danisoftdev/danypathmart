<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LocationHelper;
use App\Helpers\Response;
use App\Helpers\StaffPermission;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('edit_company_settings');

$pdo = Database::pdo();
$body = Response::body();

$companyName = trim((string) ($body['company_name'] ?? ''));
if ($companyName === '') {
    Response::error('Company name is required.', 422);
}

$email = trim((string) ($body['email'] ?? ''));
if ($email !== '' && !Validator::email($email)) {
    Response::error('Please enter a valid contact email.', 422);
}

$rate = $body['usd_to_ghs_rate'] ?? 0;
if (!is_numeric($rate) || (float) $rate < 0) {
    Response::error('USD to GHS rate must be a positive number.', 422);
}

$paystackEnabled = boolFlag($body['paystack_enabled'] ?? true);
$walletCheckout = boolFlag($body['wallet_checkout_enabled'] ?? false);
$bankTransfer = boolFlag($body['bank_transfer_enabled'] ?? false);
$podEnabled = boolFlag($body['pod_enabled'] ?? false);
$payBeforeDelivery = boolFlag($body['pay_before_delivery'] ?? true);

if (!$paystackEnabled && !$walletCheckout && !$bankTransfer && !$podEnabled) {
    Response::error('Enable at least one payment method.', 422);
}

$exchangeDays = isset($body['exchange_within_days']) ? max(1, (int) $body['exchange_within_days']) : 7;
$quotesEnabled = boolFlag($body['quotes_enabled'] ?? true);
$payLaterEnabled = boolFlag($body['institutional_pay_later_enabled'] ?? true);

$fields = [
    'company_name'            => $companyName,
    'email'                   => $email !== '' ? $email : null,
    'phone'                   => nullable($body['phone'] ?? null),
    'whatsapp_group'          => nullable($body['whatsapp_group'] ?? null),
    'whatsapp_support'        => nullable($body['whatsapp_support'] ?? null),
    'facebook'                => nullable($body['facebook'] ?? null),
    'instagram'               => nullable($body['instagram'] ?? null),
    'twitter'                 => nullable($body['twitter'] ?? null),
    'address'                 => nullable($body['address'] ?? null),
    'business_hours'          => nullable($body['business_hours'] ?? null),
    'return_policy'           => nullable($body['return_policy'] ?? null),
    'paystack_enabled'        => $paystackEnabled,
    'wallet_checkout_enabled' => $walletCheckout,
    'bank_transfer_enabled'   => $bankTransfer,
    'pod_enabled'             => $podEnabled,
    'pay_before_delivery'     => $payBeforeDelivery,
    'bank_name'               => nullable($body['bank_name'] ?? null),
    'bank_account_name'       => nullable($body['bank_account_name'] ?? null),
    'bank_account_number'     => nullable($body['bank_account_number'] ?? null),
    'exchange_enabled'        => boolFlag($body['exchange_enabled'] ?? true),
    'exchange_within_days'    => $exchangeDays,
    'exchange_policy_note'    => nullable($body['exchange_policy_note'] ?? null),
    'quotes_enabled'          => $quotesEnabled,
    'institutional_pay_later_enabled' => $payLaterEnabled,
    'usd_to_ghs_rate'         => (float) $rate,
    'updated_by'              => (int) $user['id'],
];

$stmt = $pdo->prepare(
    'INSERT INTO company_settings
        (id, company_name, email, phone, whatsapp_group, whatsapp_support,
         facebook, instagram, twitter, address, business_hours, return_policy,
         paystack_enabled, wallet_checkout_enabled, bank_transfer_enabled,
         pod_enabled, pay_before_delivery, bank_name, bank_account_name, bank_account_number,
         exchange_enabled, exchange_within_days, exchange_policy_note,
         quotes_enabled, institutional_pay_later_enabled,
         usd_to_ghs_rate, updated_by)
     VALUES
        (1, :company_name, :email, :phone, :whatsapp_group, :whatsapp_support,
         :facebook, :instagram, :twitter, :address, :business_hours, :return_policy,
         :paystack_enabled, :wallet_checkout_enabled, :bank_transfer_enabled,
         :pod_enabled, :pay_before_delivery, :bank_name, :bank_account_name, :bank_account_number,
         :exchange_enabled, :exchange_within_days, :exchange_policy_note,
         :quotes_enabled, :institutional_pay_later_enabled,
         :usd_to_ghs_rate, :updated_by)
     ON DUPLICATE KEY UPDATE
        company_name = VALUES(company_name),
        email = VALUES(email),
        phone = VALUES(phone),
        whatsapp_group = VALUES(whatsapp_group),
        whatsapp_support = VALUES(whatsapp_support),
        facebook = VALUES(facebook),
        instagram = VALUES(instagram),
        twitter = VALUES(twitter),
        address = VALUES(address),
        business_hours = VALUES(business_hours),
        return_policy = VALUES(return_policy),
        paystack_enabled = VALUES(paystack_enabled),
        wallet_checkout_enabled = VALUES(wallet_checkout_enabled),
        bank_transfer_enabled = VALUES(bank_transfer_enabled),
        pod_enabled = VALUES(pod_enabled),
        pay_before_delivery = VALUES(pay_before_delivery),
        bank_name = VALUES(bank_name),
        bank_account_name = VALUES(bank_account_name),
        bank_account_number = VALUES(bank_account_number),
        exchange_enabled = VALUES(exchange_enabled),
        exchange_within_days = VALUES(exchange_within_days),
        exchange_policy_note = VALUES(exchange_policy_note),
        quotes_enabled = VALUES(quotes_enabled),
        institutional_pay_later_enabled = VALUES(institutional_pay_later_enabled),
        usd_to_ghs_rate = VALUES(usd_to_ghs_rate),
        updated_by = VALUES(updated_by)'
);

try {
    $stmt->execute($fields);
} catch (\Throwable $e) {
    // Fallback when payment columns not migrated yet — save base fields only.
    $base = [
        'company_name'    => $fields['company_name'],
        'email'           => $fields['email'],
        'phone'           => $fields['phone'],
        'whatsapp_group'  => $fields['whatsapp_group'],
        'whatsapp_support'=> $fields['whatsapp_support'],
        'facebook'        => $fields['facebook'],
        'instagram'       => $fields['instagram'],
        'twitter'         => $fields['twitter'],
        'address'         => $fields['address'],
        'business_hours'  => $fields['business_hours'],
        'return_policy'   => $fields['return_policy'],
        'usd_to_ghs_rate' => $fields['usd_to_ghs_rate'],
        'updated_by'      => $fields['updated_by'],
    ];
    try {
        $pdo->prepare(
            'INSERT INTO company_settings
                (id, company_name, email, phone, whatsapp_group, whatsapp_support,
                 facebook, instagram, twitter, address, business_hours, return_policy,
                 usd_to_ghs_rate, updated_by)
             VALUES
                (1, :company_name, :email, :phone, :whatsapp_group, :whatsapp_support,
                 :facebook, :instagram, :twitter, :address, :business_hours, :return_policy,
                 :usd_to_ghs_rate, :updated_by)
             ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                email = VALUES(email),
                phone = VALUES(phone),
                whatsapp_group = VALUES(whatsapp_group),
                whatsapp_support = VALUES(whatsapp_support),
                facebook = VALUES(facebook),
                instagram = VALUES(instagram),
                twitter = VALUES(twitter),
                address = VALUES(address),
                business_hours = VALUES(business_hours),
                return_policy = VALUES(return_policy),
                usd_to_ghs_rate = VALUES(usd_to_ghs_rate),
                updated_by = VALUES(updated_by)'
        )->execute($base);
    } catch (\Throwable $fallbackError) {
        error_log('company-settings update fallback: ' . $fallbackError->getMessage());
        Response::error(
            'Could not save company settings. Run php scripts/migrate-production.php on the server, then try again.',
            500,
            ['code' => 'company_settings_save_failed']
        );
    }
}

$repeatClubEnabled = boolFlag($body['repeat_club_discount_enabled'] ?? false);
$repeatClubMode = trim((string) ($body['repeat_club_discount_mode'] ?? 'percent'));
if (!in_array($repeatClubMode, ['percent', 'free_local_delivery'], true)) {
    $repeatClubMode = 'percent';
}
$repeatClubPercent = isset($body['repeat_club_discount_percent'])
    ? max(0.0, min(100.0, (float) $body['repeat_club_discount_percent']))
    : 5.0;
$referralEnabled = boolFlag($body['referral_credit_enabled'] ?? false);
$referralAmount = isset($body['referral_credit_amount'])
    ? max(0.0, (float) $body['referral_credit_amount'])
    : 10.0;

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            repeat_club_discount_enabled = ?,
            repeat_club_discount_mode = ?,
            repeat_club_discount_percent = ?,
            referral_credit_enabled = ?,
            referral_credit_amount = ?
         WHERE id = 1'
    )->execute([
        $repeatClubEnabled,
        $repeatClubMode,
        $repeatClubPercent,
        $referralEnabled,
        $referralAmount,
    ]);
    $fields['repeat_club_discount_enabled'] = $repeatClubEnabled;
    $fields['repeat_club_discount_mode'] = $repeatClubMode;
    $fields['repeat_club_discount_percent'] = $repeatClubPercent;
    $fields['referral_credit_enabled'] = $referralEnabled;
    $fields['referral_credit_amount'] = $referralAmount;
} catch (\Throwable) {
    // Phase G migration not applied yet.
}

$weeklyExportEnabled = boolFlag($body['weekly_orders_export_enabled'] ?? false);
$weeklyExportEmail = nullable($body['weekly_orders_export_email'] ?? null);

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            weekly_orders_export_enabled = ?,
            weekly_orders_export_email = ?
         WHERE id = 1'
    )->execute([$weeklyExportEnabled, $weeklyExportEmail]);
    $fields['weekly_orders_export_enabled'] = $weeklyExportEnabled;
    $fields['weekly_orders_export_email'] = $weeklyExportEmail;
} catch (\Throwable) {
    // Phase H migration not applied yet.
}

$platformFlags = [
    'by_air_label_enabled'             => boolFlag($body['by_air_label_enabled'] ?? true),
    'careers_enabled'                  => boolFlag($body['careers_enabled'] ?? false),
    'driver_hiring_enabled'            => boolFlag($body['driver_hiring_enabled'] ?? false),
    'pickup_stations_enabled'          => boolFlag($body['pickup_stations_enabled'] ?? false),
    'marketplace_enabled'              => boolFlag($body['marketplace_enabled'] ?? false),
    'shop_applications_open'           => boolFlag($body['shop_applications_open'] ?? false),
    'driver_module_enabled'            => boolFlag($body['driver_module_enabled'] ?? false),
    'station_repack_module_enabled'    => boolFlag($body['station_repack_module_enabled'] ?? false),
    'shop_referral_commission_enabled' => boolFlag($body['shop_referral_commission_enabled'] ?? false),
];

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            by_air_label_enabled = ?,
            careers_enabled = ?,
            driver_hiring_enabled = ?,
            pickup_stations_enabled = ?,
            marketplace_enabled = ?,
            shop_applications_open = ?,
            driver_module_enabled = ?,
            station_repack_module_enabled = ?,
            shop_referral_commission_enabled = ?
         WHERE id = 1'
    )->execute(array_values($platformFlags));
    foreach ($platformFlags as $key => $val) {
        $fields[$key] = (bool) $val;
    }
} catch (\Throwable) {
    // Phase M1 migration not applied yet.
}

try {
    $defaultCommission = isset($body['default_shop_commission_percent'])
        ? round((float) $body['default_shop_commission_percent'], 2) : 10.0;
    $releaseOn = trim((string) ($body['shop_earnings_release_on'] ?? 'collected'));
    if (!in_array($releaseOn, ['paid', 'collected'], true)) {
        $releaseOn = 'collected';
    }
    $pdo->prepare(
        'UPDATE company_settings SET default_shop_commission_percent = ?, shop_earnings_release_on = ? WHERE id = 1'
    )->execute([$defaultCommission, $releaseOn]);
    $fields['default_shop_commission_percent'] = $defaultCommission;
    $fields['shop_earnings_release_on'] = $releaseOn;
} catch (\Throwable) {
    // Phase M4 migration not applied yet.
}

try {
    $bonusAmount = isset($body['shop_referral_bonus_amount'])
        ? max(0.0, round((float) $body['shop_referral_bonus_amount'], 2)) : 50.0;
    $salesTarget = isset($body['shop_referral_sales_target'])
        ? max(1, (int) $body['shop_referral_sales_target']) : 10;
    $countOn = trim((string) ($body['shop_referral_count_on'] ?? 'collected'));
    if (!in_array($countOn, ['paid', 'collected'], true)) {
        $countOn = 'collected';
    }
    $pdo->prepare(
        'UPDATE company_settings SET shop_referral_bonus_amount = ?, shop_referral_sales_target = ?, shop_referral_count_on = ? WHERE id = 1'
    )->execute([$bonusAmount, $salesTarget, $countOn]);
    $fields['shop_referral_bonus_amount'] = $bonusAmount;
    $fields['shop_referral_sales_target'] = $salesTarget;
    $fields['shop_referral_count_on'] = $countOn;
} catch (\Throwable) {
    // Phase M5 migration not applied yet.
}

if (($user['role'] ?? '') === 'super_admin') {
    try {
        $subPercent = isset($body['subscription_referral_percent'])
            ? max(0.0, min(100.0, round((float) $body['subscription_referral_percent'], 2))) : 15.0;
        $subSources = trim((string) ($body['subscription_referral_sources'] ?? 'both'));
        if (!in_array($subSources, ['both', 'promoter', 'shop'], true)) {
            $subSources = 'both';
        }
        $pdo->prepare(
            'UPDATE company_settings SET subscription_referral_percent = ?, subscription_referral_sources = ? WHERE id = 1'
        )->execute([$subPercent, $subSources]);
        $fields['subscription_referral_percent'] = $subPercent;
        $fields['subscription_referral_sources'] = $subSources;
    } catch (\Throwable) {
        // Migration 051 not applied yet.
    }
}

try {
    $leaveEnabled = boolFlag($body['leave_requests_enabled'] ?? false);
    $leaveDays = isset($body['default_annual_leave_days'])
        ? max(1, min(365, (int) $body['default_annual_leave_days'])) : 21;
    $pdo->prepare(
        'UPDATE company_settings SET leave_requests_enabled = ?, default_annual_leave_days = ? WHERE id = 1'
    )->execute([$leaveEnabled, $leaveDays]);
    $fields['leave_requests_enabled'] = (bool) $leaveEnabled;
    $fields['default_annual_leave_days'] = $leaveDays;
} catch (\Throwable) {
    // Phase P4 migration not applied yet.
}

try {
    $analyticsEnabled = boolFlag($body['analytics_enabled'] ?? false);
    $gaId = nullable($body['google_analytics_id'] ?? null);
    if ($gaId !== null) {
        $gaId = strtoupper($gaId);
    }
    if ($analyticsEnabled && ($gaId === null || !\App\Helpers\OpsSettings::isValidMeasurementId($gaId))) {
        Response::error('Invalid Google Analytics measurement ID. Use GA4 format G-XXXXXXXX.', 422);
    }
    $uptimeUrl = nullable($body['uptime_monitor_url'] ?? null);
    if ($uptimeUrl !== null && !filter_var($uptimeUrl, FILTER_VALIDATE_URL)) {
        Response::error('Uptime monitor URL must be a valid https URL.', 422);
    }
    $pdo->prepare(
        'UPDATE company_settings SET analytics_enabled = ?, google_analytics_id = ?, uptime_monitor_url = ? WHERE id = 1'
    )->execute([$analyticsEnabled, $gaId, $uptimeUrl]);
    $fields['analytics_enabled'] = (bool) $analyticsEnabled;
    $fields['google_analytics_id'] = $gaId;
    $fields['uptime_monitor_url'] = $uptimeUrl;
} catch (\Throwable) {
    // Phase P5 migration not applied yet.
}

if (($user['role'] ?? '') === 'super_admin'
    || StaffPermission::userHasAny((int) $user['id'], (string) $user['role'], ['manage_image_search'])) {
    try {
        $imageSearchEnabled = boolFlag($body['image_search_enabled'] ?? false);
        $pdo->prepare(
            'UPDATE company_settings SET image_search_enabled = ? WHERE id = 1'
        )->execute([$imageSearchEnabled]);
        $fields['image_search_enabled'] = (bool) $imageSearchEnabled;
    } catch (\Throwable) {
        // Migration 050 not applied yet.
    }
}

if (($user['role'] ?? '') === 'super_admin'
    || StaffPermission::userHasAny((int) $user['id'], (string) $user['role'], ['manage_shop_fees'])) {
    try {
        $shopBillingEnabled = boolFlag($body['shop_billing_enabled'] ?? false);
        $shopRegFee = isset($body['shop_registration_fee_ghs'])
            ? max(0.0, round((float) $body['shop_registration_fee_ghs'], 2)) : 0.0;
        $shopMonthly = isset($body['shop_renewal_fee_monthly_ghs'])
            ? max(0.0, round((float) $body['shop_renewal_fee_monthly_ghs'], 2)) : null;
        $shopYearly = isset($body['shop_renewal_fee_yearly_ghs'])
            ? max(0.0, round((float) $body['shop_renewal_fee_yearly_ghs'], 2)) : null;
        $shopRenewPeriod = trim((string) ($body['shop_renewal_period'] ?? 'yearly'));
        if (!in_array($shopRenewPeriod, ['monthly', 'yearly'], true)) {
            $shopRenewPeriod = 'yearly';
        }
        $shopGraceDays = isset($body['shop_renewal_grace_days'])
            ? max(0, (int) $body['shop_renewal_grace_days']) : 7;

        // Legacy single fee fallback when new fields omitted.
        if ($shopMonthly === null && $shopYearly === null && isset($body['shop_renewal_fee_ghs'])) {
            $legacy = max(0.0, round((float) $body['shop_renewal_fee_ghs'], 2));
            if ($shopRenewPeriod === 'monthly') {
                $shopMonthly = $legacy;
                $shopYearly = 0.0;
            } else {
                $shopYearly = $legacy;
                $shopMonthly = 0.0;
            }
        }
        $existingBilling = \App\Helpers\ShopBillingService::loadSettings($pdo);
        if ($shopMonthly === null) {
            $shopMonthly = (float) $existingBilling['shop_renewal_fee_monthly_ghs'];
        }
        if ($shopYearly === null) {
            $shopYearly = (float) $existingBilling['shop_renewal_fee_yearly_ghs'];
        }
        if ($shopRenewPeriod === 'monthly' && $shopMonthly <= 0 && $shopYearly > 0) {
            $shopRenewPeriod = 'yearly';
        }
        if ($shopRenewPeriod === 'yearly' && $shopYearly <= 0 && $shopMonthly > 0) {
            $shopRenewPeriod = 'monthly';
        }
        $shopRenewFee = $shopRenewPeriod === 'monthly' ? $shopMonthly : $shopYearly;

        try {
            $pdo->prepare(
                'UPDATE company_settings SET
                    shop_billing_enabled = ?,
                    shop_registration_fee_ghs = ?,
                    shop_renewal_fee_ghs = ?,
                    shop_renewal_fee_monthly_ghs = ?,
                    shop_renewal_fee_yearly_ghs = ?,
                    shop_renewal_period = ?,
                    shop_renewal_grace_days = ?
                 WHERE id = 1'
            )->execute([
                $shopBillingEnabled, $shopRegFee, $shopRenewFee,
                $shopMonthly, $shopYearly, $shopRenewPeriod, $shopGraceDays,
            ]);
        } catch (\Throwable) {
            $pdo->prepare(
                'UPDATE company_settings SET
                    shop_billing_enabled = ?,
                    shop_registration_fee_ghs = ?,
                    shop_renewal_fee_ghs = ?,
                    shop_renewal_period = ?,
                    shop_renewal_grace_days = ?
                 WHERE id = 1'
            )->execute([$shopBillingEnabled, $shopRegFee, $shopRenewFee, $shopRenewPeriod, $shopGraceDays]);
        }

        $fields['shop_billing_enabled'] = (bool) $shopBillingEnabled;
        $fields['shop_registration_fee_ghs'] = $shopRegFee;
        $fields['shop_renewal_fee_ghs'] = $shopRenewFee;
        $fields['shop_renewal_fee_monthly_ghs'] = $shopMonthly;
        $fields['shop_renewal_fee_yearly_ghs'] = $shopYearly;
        $fields['shop_renewal_period'] = $shopRenewPeriod;
        $fields['shop_renewal_grace_days'] = $shopGraceDays;
    } catch (\Throwable) {
        // Phase M6 shop billing migration not applied yet.
    }
}

try {
    $coords = LocationHelper::parseLatLng($body);
    $pdo->prepare('UPDATE company_settings SET latitude = ?, longitude = ? WHERE id = 1')
        ->execute([$coords['latitude'], $coords['longitude']]);
    $fields['latitude'] = $coords['latitude'];
    $fields['longitude'] = $coords['longitude'];
} catch (\Throwable) {
    // Migration 056 not applied yet.
}

Response::success(['message' => 'Company settings saved.', 'settings' => $fields]);

function nullable(mixed $value): ?string
{
    $v = trim((string) ($value ?? ''));
    return $v !== '' ? $v : null;
}

function boolFlag(mixed $value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if (is_numeric($value)) {
        return (int) $value !== 0 ? 1 : 0;
    }
    $v = strtolower(trim((string) $value));
    return in_array($v, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}
