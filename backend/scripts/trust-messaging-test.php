<?php

declare(strict_types=1);

/**
 * Smoke test: trust & messaging (reviews, push subs, bot nodes, catalog settings).
 * Run: php backend/scripts/trust-messaging-test.php
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
use App\Config\Env;
use App\Helpers\InventoryService;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\ProductReviewService;
use App\Helpers\SupportBotService;

Env::load();
$pdo = Database::pdo();

$fail = 0;
$ok = static function (string $label) use (&$fail): void {
    echo "  OK: {$label}\n";
};
$check = static function (bool $cond, string $label) use (&$fail, $ok): void {
    if ($cond) {
        $ok($label);
    } else {
        echo "  FAIL: {$label}\n";
        $fail++;
    }
};

echo "Trust & messaging smoke test\n\n";

try {
    $pdo->query('SELECT units_sold FROM products LIMIT 1');
    $ok('products.units_sold column');
} catch (Throwable $e) {
    $check(false, 'products.units_sold — run migration 055');
}

try {
    $pdo->query('SELECT 1 FROM product_reviews LIMIT 1');
    $ok('product_reviews table');
} catch (Throwable) {
    $check(false, 'product_reviews table');
}

try {
    $pdo->query('SELECT 1 FROM push_subscriptions LIMIT 1');
    $ok('push_subscriptions table');
} catch (Throwable) {
    $check(false, 'push_subscriptions table');
}

try {
    $pdo->query('SELECT 1 FROM support_bot_nodes LIMIT 1');
    $ok('support_bot_nodes table');
} catch (Throwable) {
    $check(false, 'support_bot_nodes table');
}

$nodes = SupportBotService::children($pdo, 'root');
$check(count($nodes) >= 3, 'bot root has options (' . count($nodes) . ')');

$inv = InventoryService::displaySettings($pdo);
$check(is_bool($inv['stock_decrement_on_payment']), 'InventoryService::displaySettings');

$msg = MessagingIntegrationService::load($pdo);
$check(array_key_exists('push_notifications_enabled', $msg), 'MessagingIntegrationService::load');

$band = InventoryService::unitsSoldBand(15);
$check($band === '10+ sold', 'unitsSoldBand(15) = ' . ($band ?? 'null'));

$reviews = ProductReviewService::listForProduct($pdo, 1);
$check(is_array($reviews), 'ProductReviewService::listForProduct');

echo "\n";
if ($fail > 0) {
    echo "FAILED: {$fail} check(s)\n";
    exit(1);
}
echo "All checks passed.\n";
