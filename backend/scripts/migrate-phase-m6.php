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

$cols = [
    'shop_badge_label' => 'ALTER TABLE products ADD COLUMN shop_badge_label VARCHAR(40) DEFAULT NULL',
    'shop_promo_free_delivery' => 'ALTER TABLE products ADD COLUMN shop_promo_free_delivery TINYINT(1) NOT NULL DEFAULT 0',
    'shop_badge_hidden' => 'ALTER TABLE products ADD COLUMN shop_badge_hidden TINYINT(1) NOT NULL DEFAULT 0',
];

foreach ($cols as $name => $sql) {
    if (!columnExists($pdo, 'products', $name)) {
        $pdo->exec($sql);
        echo "Added products.{$name}\n";
    }
}

echo "Phase M6 shop promo badges migration complete.\n";
