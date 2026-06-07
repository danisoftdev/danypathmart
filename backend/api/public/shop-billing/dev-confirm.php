<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Response;
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

if ($type === 'renewal' && $shopId > 0) {
    ShopBillingService::markRenewalPaid($pdo, $shopId, $reference);
} elseif ($applicationId > 0) {
    ShopBillingService::markRegistrationPaid($pdo, $applicationId, $reference);
} elseif ($row['application_id']) {
    ShopBillingService::markRegistrationPaid($pdo, (int) $row['application_id'], $reference);
} elseif ($row['shop_id']) {
    ShopBillingService::markRenewalPaid($pdo, (int) $row['shop_id'], $reference);
} else {
    Response::error('Could not resolve payment target.', 422);
}

Response::success(['message' => 'Mock payment confirmed.', 'reference' => $reference]);
