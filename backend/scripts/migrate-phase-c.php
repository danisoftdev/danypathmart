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

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

$pdo = Database::pdo();

if (!tableExists($pdo, 'size_guides')) {
    $pdo->exec(
        'CREATE TABLE size_guides (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(120) NOT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created size_guides\n";
}

if (!tableExists($pdo, 'size_guide_rows')) {
    $pdo->exec(
        'CREATE TABLE size_guide_rows (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            size_guide_id BIGINT UNSIGNED NOT NULL,
            size_label VARCHAR(40) NOT NULL,
            chest_min DECIMAL(6,1) DEFAULT NULL,
            chest_max DECIMAL(6,1) DEFAULT NULL,
            waist_min DECIMAL(6,1) DEFAULT NULL,
            waist_max DECIMAL(6,1) DEFAULT NULL,
            height_min DECIMAL(6,1) DEFAULT NULL,
            height_max DECIMAL(6,1) DEFAULT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_size_guide_rows_guide (size_guide_id, sort_order),
            CONSTRAINT fk_size_guide_rows_guide FOREIGN KEY (size_guide_id)
                REFERENCES size_guides (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created size_guide_rows\n";
}

if (!columnExists($pdo, 'categories', 'size_guide_id')) {
    $pdo->exec('ALTER TABLE categories ADD COLUMN size_guide_id BIGINT UNSIGNED DEFAULT NULL AFTER parent_id');
    echo "added categories.size_guide_id\n";
}

if (!columnExists($pdo, 'products', 'size_guide_id')) {
    $pdo->exec('ALTER TABLE products ADD COLUMN size_guide_id BIGINT UNSIGNED DEFAULT NULL AFTER category_id');
    echo "added products.size_guide_id\n";
}

$companyCols = [
    ['exchange_enabled', "ALTER TABLE company_settings ADD COLUMN exchange_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER bank_account_number"],
    ['exchange_within_days', "ALTER TABLE company_settings ADD COLUMN exchange_within_days INT NOT NULL DEFAULT 7 AFTER exchange_enabled"],
    ['exchange_policy_note', "ALTER TABLE company_settings ADD COLUMN exchange_policy_note TEXT DEFAULT NULL AFTER exchange_within_days"],
];
foreach ($companyCols as [$col, $sql]) {
    if (!columnExists($pdo, 'company_settings', $col)) {
        $pdo->exec($sql);
        echo "added company_settings.{$col}\n";
    }
}

echo "Phase C sizing migration complete.\n";
