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
    ['company_settings', 'flash_sale_enabled', "ALTER TABLE company_settings ADD COLUMN flash_sale_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER usd_to_ghs_rate"],
    ['company_settings', 'flash_sale_title', "ALTER TABLE company_settings ADD COLUMN flash_sale_title VARCHAR(120) NOT NULL DEFAULT 'Flash deals' AFTER flash_sale_enabled"],
    ['company_settings', 'flash_sale_subtitle', "ALTER TABLE company_settings ADD COLUMN flash_sale_subtitle VARCHAR(255) DEFAULT 'Limited picks — ends soon' AFTER flash_sale_title"],
    ['company_settings', 'flash_sale_ends_at', 'ALTER TABLE company_settings ADD COLUMN flash_sale_ends_at DATETIME DEFAULT NULL AFTER flash_sale_subtitle'],
];

foreach ($migrations as [$table, $column, $sql]) {
    if (columnExists($pdo, $table, $column)) {
        echo "skip {$table}.{$column} (exists)\n";
        continue;
    }
    $pdo->exec($sql);
    echo "added {$table}.{$column}\n";
}

echo "Flash sale migration complete.\n";
