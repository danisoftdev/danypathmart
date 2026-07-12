<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Response;
use App\Helpers\ShopBillingReceiptService;
use App\Helpers\ShopBillingService;

/** Dev-only: confirm mock shop billing payment when Paystack is not configured. */
$pdo = Database::pdo();
$body = Response::body();

$reference = trim((string) ($body['reference'] ?? ''));
$applicationId = (int) ($body['application_id'] ?? 0);
$shopId = (int) ($body['shop_id'] ?? 0);
$type = trim((string) ($body['type'] ?? 'registration'));

$secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
$configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');
if ($configured) {
    Response::error('Dev confirm is only available without Paystack configured.', 403);
}

if ($reference === '' || !str_starts_with($reference, 'SHOP-DEV-')) {
    Response::error('Invalid mock reference.', 422);
}

$stmt = $pdo->prepare('SELECT * FROM shop_billing_payments WHERE paystack_ref = ? AND status = ? LIMIT 1');
$stmt->execute([$reference, 'pending']);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Payment not found or already confirmed.', 404);
}

$resolvedShopId = $shopId > 0 ? $shopId : (int) ($row['shop_id'] ?? 0);

if (($type === 'card_setup' || ($row['payment_type'] ?? '') === 'card_setup') && $resolvedShopId > 0) {
    $pdo->prepare(
        'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
    )->execute(['paid', $reference]);
    ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, [
        'channel'       => 'card',
        'authorization' => [
            'authorization_code' => 'AUTH_DEV_' . $resolvedShopId,
            'reusable'           => true,
            'card_type'          => 'visa',
            'last4'              => '4242',
            'exp_month'          => '12',
            'exp_year'           => '2030',
            'bank'               => 'TEST BANK',
        ],
        'customer' => ['customer_code' => 'CUS_DEV_' . $resolvedShopId],
    ]);
    ShopBillingReceiptService::saveAuthorization(
        $pdo,
        $resolvedShopId,
        [
            'authorization_code' => 'AUTH_DEV_' . $resolvedShopId,
            'reusable'           => true,
            'card_type'          => 'visa',
            'last4'              => '4242',
            'exp_month'          => '12',
            'exp_year'           => '2030',
            'bank'               => 'TEST BANK',
        ],
        'CUS_DEV_' . $resolvedShopId
    );
} elseif ($type === 'renewal' && $resolvedShopId > 0) {
    ShopBillingService::markRenewalPaid($pdo, $resolvedShopId, $reference);
    ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, ['channel' => 'card']);
} elseif ($applicationId > 0) {
    ShopBillingService::markRegistrationPaid($pdo, $applicationId, $reference);
    ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference);
} elseif ($row['application_id']) {
    ShopBillingService::markRegistrationPaid($pdo, (int) $row['application_id'], $reference);
    ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference);
} elseif ($row['shop_id']) {
    ShopBillingService::markRenewalPaid($pdo, (int) $row['shop_id'], $reference);
    ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, ['channel' => 'card']);
} else {
    Response::error('Could not resolve payment target.', 422);
}

Response::success(['message' => 'Mock payment confirmed.', 'reference' => $reference]);
