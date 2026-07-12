<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_shop_fees');

$pdo = Database::pdo();
$body = Response::body();

$enabled = boolFlag($body['shop_billing_enabled'] ?? false);
$regFee = isset($body['shop_registration_fee_ghs']) ? max(0.0, round((float) $body['shop_registration_fee_ghs'], 2)) : 0.0;
$monthlyFee = isset($body['shop_renewal_fee_monthly_ghs'])
    ? max(0.0, round((float) $body['shop_renewal_fee_monthly_ghs'], 2))
    : (isset($body['shop_renewal_fee_ghs']) && ($body['shop_renewal_period'] ?? '') === 'monthly'
        ? max(0.0, round((float) $body['shop_renewal_fee_ghs'], 2)) : null);
$yearlyFee = isset($body['shop_renewal_fee_yearly_ghs'])
    ? max(0.0, round((float) $body['shop_renewal_fee_yearly_ghs'], 2))
    : (isset($body['shop_renewal_fee_ghs']) && ($body['shop_renewal_period'] ?? 'yearly') !== 'monthly'
        ? max(0.0, round((float) $body['shop_renewal_fee_ghs'], 2)) : null);

$existing = ShopBillingService::loadSettings($pdo);
if ($monthlyFee === null) {
    $monthlyFee = (float) $existing['shop_renewal_fee_monthly_ghs'];
}
if ($yearlyFee === null) {
    $yearlyFee = (float) $existing['shop_renewal_fee_yearly_ghs'];
}

$period = trim((string) ($body['shop_renewal_period'] ?? $existing['shop_renewal_period'] ?? 'yearly'));
if (!in_array($period, ['monthly', 'yearly'], true)) {
    $period = 'yearly';
}
if ($period === 'monthly' && $monthlyFee <= 0 && $yearlyFee > 0) {
    $period = 'yearly';
}
if ($period === 'yearly' && $yearlyFee <= 0 && $monthlyFee > 0) {
    $period = 'monthly';
}

$legacyFee = $period === 'monthly' ? $monthlyFee : $yearlyFee;
$graceDays = 0;

if (array_key_exists('shop_new_shop_free_month_enabled', $body)) {
    $freeMonth = boolFlag($body['shop_new_shop_free_month_enabled']);
} else {
    $freeMonth = !empty($existing['shop_new_shop_free_month_enabled']) ? 1 : 0;
}

$feeMode = trim((string) ($body['paystack_fee_mode'] ?? $existing['paystack_fee_mode'] ?? 'absorb'));
if (!in_array($feeMode, ['absorb', 'pass_to_payer'], true)) {
    $feeMode = 'absorb';
}
$feePercent = isset($body['paystack_fee_percent'])
    ? max(0.0, min(100.0, round((float) $body['paystack_fee_percent'], 2)))
    : (float) $existing['paystack_fee_percent'];
$feeFlat = isset($body['paystack_fee_flat_ghs'])
    ? max(0.0, round((float) $body['paystack_fee_flat_ghs'], 2))
    : (float) $existing['paystack_fee_flat_ghs'];
$feeNote = array_key_exists('paystack_fee_note', $body)
    ? (trim((string) $body['paystack_fee_note']) !== '' ? trim((string) $body['paystack_fee_note']) : null)
    : ($existing['paystack_fee_note'] ?? null);

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            shop_billing_enabled = ?,
            shop_registration_fee_ghs = ?,
            shop_renewal_fee_ghs = ?,
            shop_renewal_fee_monthly_ghs = ?,
            shop_renewal_fee_yearly_ghs = ?,
            shop_renewal_period = ?,
            shop_renewal_grace_days = ?,
            shop_new_shop_free_month_enabled = ?,
            paystack_fee_mode = ?,
            paystack_fee_percent = ?,
            paystack_fee_flat_ghs = ?,
            paystack_fee_note = ?,
            updated_by = ?
         WHERE id = 1'
    )->execute([
        $enabled ? 1 : 0,
        $regFee,
        $legacyFee,
        $monthlyFee,
        $yearlyFee,
        $period,
        $graceDays,
        $freeMonth,
        $feeMode,
        $feePercent,
        $feeFlat,
        $feeNote,
        (int) $user['id'],
    ]);
} catch (\Throwable) {
    try {
        $pdo->prepare(
            'UPDATE company_settings SET
                shop_billing_enabled = ?,
                shop_registration_fee_ghs = ?,
                shop_renewal_fee_ghs = ?,
                shop_renewal_fee_monthly_ghs = ?,
                shop_renewal_fee_yearly_ghs = ?,
                shop_renewal_period = ?,
                shop_renewal_grace_days = ?,
                shop_new_shop_free_month_enabled = ?,
                updated_by = ?
             WHERE id = 1'
        )->execute([
            $enabled ? 1 : 0,
            $regFee,
            $legacyFee,
            $monthlyFee,
            $yearlyFee,
            $period,
            $graceDays,
            $freeMonth,
            (int) $user['id'],
        ]);
    } catch (\Throwable) {
        Response::error('Shop billing migration not applied yet. Run migrations 047, 065, 066, and 067.', 503);
    }
}

Response::success([
    'message'  => 'Shop billing settings saved.',
    'settings' => ShopBillingService::loadSettings($pdo),
]);

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
