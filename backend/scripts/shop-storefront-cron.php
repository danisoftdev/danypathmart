<?php

declare(strict_types=1);

/**
 * Daily cron: shop subscription reminders + unpaid storefront order cleanup.
 * Usage: php scripts/shop-storefront-cron.php
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
use App\Helpers\ShopSubscriptionReminderService;
use App\Helpers\StorefrontOrderService;

$pdo = Database::pdo();
$reminders = ShopSubscriptionReminderService::runDue($pdo);
$cancelled = StorefrontOrderService::cancelExpiredUnpaid($pdo);

echo "shop-storefront-cron: reminders_sent={$reminders} unpaid_cancelled={$cancelled}\n";
