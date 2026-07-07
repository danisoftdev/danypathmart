<?php

declare(strict_types=1);

/**
 * Smoke test for shop storefront v2 helpers (no HTTP).
 * Usage: php scripts/shop-storefront-smoke-test.php
 */

require __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));
    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Database;
use App\Helpers\ShopBillingService;
use App\Helpers\ShopReportService;
use App\Helpers\StaffPermission;
use App\Helpers\TrustAutomationService;
use App\Helpers\UserCautionService;

$pdo = Database::pdo();

function ok(bool $cond, string $msg): void
{
    echo ($cond ? 'OK  ' : 'FAIL') . ' ' . $msg . PHP_EOL;
    if (!$cond) {
        exit(1);
    }
}

ok(method_exists(ShopBillingService::class, 'isShopPubliclyVisible'), 'isShopPubliclyVisible exists');
ok(in_array('resolve_shop_reports', StaffPermission::KEYS, true), 'resolve_shop_reports permission');
ok(ShopReportService::REASONS !== [], 'shop report reasons');
ok(TrustAutomationService::settings($pdo) !== [], 'trust settings load');
ok(UserCautionService::LEVELS !== [], 'caution levels');

echo "shop-storefront-smoke-test passed\n";
