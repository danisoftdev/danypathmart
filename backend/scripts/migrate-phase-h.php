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

$changes = [
    ['weekly_orders_export_enabled', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['weekly_orders_export_email', 'VARCHAR(255) NULL'],
    ['weekly_orders_export_last_sent', 'DATETIME NULL'],
];

foreach ($changes as [$col, $def]) {
    if (!columnExists($pdo, 'company_settings', $col)) {
        $pdo->exec("ALTER TABLE company_settings ADD COLUMN {$col} {$def}");
        echo "Added company_settings.{$col}\n";
    } else {
        echo "Skip company_settings.{$col} (exists)\n";
    }
}

echo "Phase H migration complete.\n";
