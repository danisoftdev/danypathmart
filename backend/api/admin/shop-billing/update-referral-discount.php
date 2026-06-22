<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_referral_registration_discount');

$pdo = Database::pdo();
$body = Response::body();

$enabled = boolFlag($body['shop_referral_reg_discount_enabled'] ?? false);
$type = trim((string) ($body['shop_referral_reg_discount_type'] ?? 'percent'));
if (!in_array($type, ['percent', 'fixed'], true)) {
    $type = 'percent';
}
$value = isset($body['shop_referral_reg_discount_value'])
    ? max(0.0, round((float) $body['shop_referral_reg_discount_value'], 2))
    : 0.0;

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            shop_referral_reg_discount_enabled = ?,
            shop_referral_reg_discount_type = ?,
            shop_referral_reg_discount_value = ?,
            updated_by = ?
         WHERE id = 1'
    )->execute([
        $enabled ? 1 : 0,
        $type,
        $value,
        (int) $user['id'],
    ]);
} catch (\Throwable) {
    Response::error('Referral registration discount migration not applied. Run migration 054.', 503);
}

Response::success([
    'message'  => 'Referral applicant discount settings saved.',
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
