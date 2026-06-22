<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_shop_registration_promo');

$pdo = Database::pdo();
$body = Response::body();

$freeUntil = isset($body['shop_registration_free_until']) && trim((string) $body['shop_registration_free_until']) !== ''
    ? trim((string) $body['shop_registration_free_until'])
    : null;
if ($freeUntil !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $freeUntil) !== 1) {
    Response::error('Free registration until must be YYYY-MM-DD.', 422);
}

$firstEnabled = boolFlag($body['shop_first_reg_discount_enabled'] ?? false);
$firstType = trim((string) ($body['shop_first_reg_discount_type'] ?? 'fixed'));
if (!in_array($firstType, ['percent', 'fixed'], true)) {
    $firstType = 'fixed';
}
$firstValue = isset($body['shop_first_reg_discount_value'])
    ? max(0.0, round((float) $body['shop_first_reg_discount_value'], 2))
    : 0.0;

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            shop_registration_free_until = ?,
            shop_first_reg_discount_enabled = ?,
            shop_first_reg_discount_type = ?,
            shop_first_reg_discount_value = ?,
            updated_by = ?
         WHERE id = 1'
    )->execute([
        $freeUntil,
        $firstEnabled ? 1 : 0,
        $firstType,
        $firstValue,
        (int) $user['id'],
    ]);
} catch (\Throwable) {
    Response::error('Shop registration promo migration not applied. Run migration 054.', 503);
}

Response::success([
    'message'  => 'Registration promo settings saved.',
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
