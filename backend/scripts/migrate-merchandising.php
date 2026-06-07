<?php

declare(strict_types=1);

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
    ['products', 'compare_at_price', 'ALTER TABLE products ADD COLUMN compare_at_price DECIMAL(12,2) DEFAULT NULL AFTER cost_price'],
    ['products', 'rating_avg', 'ALTER TABLE products ADD COLUMN rating_avg DECIMAL(2,1) DEFAULT NULL AFTER compare_at_price'],
    ['products', 'rating_count', 'ALTER TABLE products ADD COLUMN rating_count INT NOT NULL DEFAULT 0 AFTER rating_avg'],
    ['products', 'badge_label', 'ALTER TABLE products ADD COLUMN badge_label VARCHAR(40) DEFAULT NULL AFTER rating_count'],
    ['products', 'is_featured', 'ALTER TABLE products ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER badge_label'],
    ['products', 'is_flash_deal', 'ALTER TABLE products ADD COLUMN is_flash_deal TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured'],
];

foreach ($migrations as [$table, $column, $sql]) {
    if (columnExists($pdo, $table, $column)) {
        echo "skip {$table}.{$column} (exists)\n";
        continue;
    }
    $pdo->exec($sql);
    echo "added {$table}.{$column}\n";
}

echo "Merchandising migration complete.\n";
