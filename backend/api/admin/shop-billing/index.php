<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Helpers\ShopService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny([
    'view_shop_billing',
    'manage_shop_fees',
    'manage_shop_registration_promo',
    'manage_referral_registration_discount',
    'waive_shop_fees',
]);

$pdo = Database::pdo();
$settings = ShopBillingService::loadSettings($pdo);
$payments = ShopBillingService::listRecentPayments($pdo, 100);

$subscriptions = [];
try {
    $rows = $pdo->query(
        'SELECT ss.*, s.name AS shop_name, s.slug
         FROM shop_subscriptions ss
         INNER JOIN shops s ON s.id = ss.shop_id
         ORDER BY ss.period_end ASC
         LIMIT 200'
    )->fetchAll() ?: [];
    foreach ($rows as $row) {
        $subscriptions[] = [
            'shop_id'      => (int) $row['shop_id'],
            'shop_name'    => $row['shop_name'],
            'shop_slug'    => $row['slug'],
            'status'       => $row['status'],
            'period_start' => $row['period_start'],
            'period_end'   => $row['period_end'],
            'waived_until' => $row['waived_until'],
            'waiver_note'  => $row['waiver_note'],
        ];
    }
} catch (\Throwable) {
    // Migration not applied yet.
}

Response::success([
    'settings'      => $settings,
    'payments'      => $payments,
    'subscriptions' => $subscriptions,
]);
