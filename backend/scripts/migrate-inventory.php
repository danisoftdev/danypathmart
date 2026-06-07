<?php

declare(strict_types=1);

/**
 * Applies pending schema updates for local/dev databases.
 * Safe to run multiple times — skips columns that already exist.
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

$migrations = [
    ['products', 'cost_price', 'ALTER TABLE products ADD COLUMN cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER price'],
    ['order_items', 'unit_cost', 'ALTER TABLE order_items ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_price'],
    ['order_items', 'unit_cbm_cost', 'ALTER TABLE order_items ADD COLUMN unit_cbm_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_cost'],
];

foreach ($migrations as [$table, $column, $sql]) {
    if (columnExists($pdo, $table, $column)) {
        echo "skip {$table}.{$column} (exists)\n";
        continue;
    }
    $pdo->exec($sql);
    echo "added {$table}.{$column}\n";
}

echo "Migration complete.\n";
