<?php

declare(strict_types=1);

/**
 * List missing tables/columns that break production API routes.
 * Usage: cd public_html/api && php scripts/db-diagnose.php
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

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);
    return (int) $stmt->fetchColumn() > 0;
}

$pdo = Database::pdo();
$issues = [];

$requiredTables = [
    'employees',
    'shops',
    'user_sessions',
    'image_search_alerts',
];

foreach ($requiredTables as $table) {
    if (!tableExists($pdo, $table)) {
        $issues[] = "MISSING TABLE: {$table}";
    }
}

// Optional CMS table — warn only (homepage hero slider).
if (!tableExists($pdo, 'hero_banners')) {
    echo "note: hero_banners table missing (run migrate-all for CMS banners)\n";
}

$requiredColumns = [
    ['products', 'compare_at_price'],
    ['products', 'is_featured'],
    ['products', 'is_flash_deal'],
    ['products', 'badge_label'],
    ['products', 'rating_avg'],
    ['products', 'shop_id'],
    ['products', 'listing_status'],
    ['products', 'cost_price'],
    ['order_items', 'unit_cost'],
    ['order_items', 'unit_cbm_cost'],
    ['company_settings', 'analytics_enabled'],
    ['company_settings', 'paystack_enabled'],
    ['company_settings', 'wallet_checkout_enabled'],
];

foreach ($requiredColumns as [$table, $column]) {
    if (tableExists($pdo, $table) && !columnExists($pdo, $table, $column)) {
        $issues[] = "MISSING COLUMN: {$table}.{$column}";
    }
}

$migrationDirs = [
    realpath(__DIR__ . '/../../database/migrations'),
    realpath(__DIR__ . '/../database/migrations'),
];
$migrationDir = null;
foreach ($migrationDirs as $dir) {
    if ($dir !== false && is_dir($dir)) {
        $migrationDir = $dir;
        break;
    }
}

echo "DanyPathMart — database diagnose\n";
echo str_repeat('-', 40) . "\n";
echo 'Database: ' . (string) $pdo->query('SELECT DATABASE()')->fetchColumn() . "\n";

try {
    $pdo->query('SELECT 1 FROM users LIMIT 1');
    echo "users table: OK\n";
} catch (Throwable $e) {
    echo "users table: FAIL — import schema.sql\n";
    exit(1);
}

if ($migrationDir === null) {
    echo "migrations folder: MISSING (upload public_html/database/migrations)\n";
} else {
    $count = count(glob($migrationDir . '/*.sql') ?: []);
    echo "migrations folder: {$migrationDir} ({$count} files)\n";
}

if ($issues === []) {
    echo "\nAll checked tables/columns present.\n";
    echo "If API still fails, check Hostinger error logs.\n";
    exit(0);
}

echo "\nIssues found:\n";
foreach ($issues as $issue) {
    echo "  ✗ {$issue}\n";
}

echo "\nFix: cd public_html/api && php scripts/migrate-production.php\n";
echo "(Requires database/migrations on server — see DEPLOY.md)\n";
exit(1);
