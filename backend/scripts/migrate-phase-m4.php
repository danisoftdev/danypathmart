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

$m4Sql = null;
foreach ([__DIR__ . '/../../database/migrations/035_marketplace_m4.sql', __DIR__ . '/../database/migrations/035_marketplace_m4.sql'] as $candidate) {
    if (is_file($candidate)) {
        $m4Sql = file_get_contents($candidate);
        break;
    }
}
if ($m4Sql !== false && $m4Sql !== null) {
    foreach (array_filter(array_map('trim', explode(';', $m4Sql))) as $statement) {
        if ($statement === '') {
            continue;
        }
        try {
            $pdo->exec($statement);
            if (preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $statement, $m) === 1) {
                echo "Ensured table {$m[1]}\n";
            }
        } catch (\Throwable $e) {
            echo "Note: {$e->getMessage()}\n";
        }
    }
}

if (!columnExists($pdo, 'products', 'shop_id')) {
    $pdo->exec('ALTER TABLE products ADD COLUMN shop_id BIGINT UNSIGNED DEFAULT NULL AFTER category_id');
    echo "Added products.shop_id\n";
}

if (!columnExists($pdo, 'products', 'listing_status')) {
    $pdo->exec(
        "ALTER TABLE products ADD COLUMN listing_status
         ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' AFTER status"
    );
    echo "Added products.listing_status\n";
}

try {
    $pdo->exec(
        'ALTER TABLE products ADD CONSTRAINT fk_products_shop FOREIGN KEY (shop_id)
         REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE'
    );
    echo "Added fk_products_shop\n";
} catch (\Throwable $e) {
    echo "Note FK: {$e->getMessage()}\n";
}

if (!columnExists($pdo, 'company_settings', 'default_shop_commission_percent')) {
    $pdo->exec(
        'ALTER TABLE company_settings ADD COLUMN default_shop_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00'
    );
    echo "Added default_shop_commission_percent\n";
}

if (!columnExists($pdo, 'company_settings', 'shop_earnings_release_on')) {
    $pdo->exec(
        "ALTER TABLE company_settings ADD COLUMN shop_earnings_release_on
         ENUM('paid','collected') NOT NULL DEFAULT 'collected' AFTER default_shop_commission_percent"
    );
    echo "Added shop_earnings_release_on\n";
}

if (!columnExists($pdo, 'shop_applications', 'logo_url')) {
    $pdo->exec('ALTER TABLE shop_applications ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL AFTER description');
    echo "Added shop_applications.logo_url\n";
}

echo "Phase M4 marketplace migration complete.\n";
