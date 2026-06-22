<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Helpers\SubscriptionReferralService;

$code = trim((string) ($_GET['code'] ?? ''));
if ($code === '') {
    Response::error('Referral code is required.', 422);
}

$pdo = Database::pdo();
$settings = SubscriptionReferralService::settings($pdo);
$billing = ShopBillingService::loadSettings($pdo);

if (!$settings['enabled'] && empty($billing['shop_referral_reg_discount_enabled'])) {
    Response::success(['valid' => false, 'message' => 'Referral program is not active.']);
}

$result = SubscriptionReferralService::validateCode($pdo, $code);
if (!$result['valid']) {
    Response::success(['valid' => false]);
}

$discountPreview = null;
if (!empty($billing['shop_referral_reg_discount_enabled'])) {
    $quote = ShopBillingService::computeRegistrationPricing($pdo, ['has_valid_referrer' => true]);
    $discountPreview = [
        'type'  => $billing['shop_referral_reg_discount_type'],
        'value' => (float) $billing['shop_referral_reg_discount_value'],
        'sample_savings' => $quote['discount_total'] > 0
            ? (float) $quote['discount_total']
            : null,
    ];
}

Response::success($result + [
    'applicant_discount' => $discountPreview,
]);
