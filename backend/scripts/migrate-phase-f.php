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

if (!tableExists($pdo, 'stock_alert_subscriptions')) {
    $pdo->exec(
        'CREATE TABLE stock_alert_subscriptions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            club_tag VARCHAR(80) DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_stock_alert (user_id, product_id),
            KEY idx_stock_alerts_product (product_id),
            CONSTRAINT fk_stock_alerts_user FOREIGN KEY (user_id)
                REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_stock_alerts_product FOREIGN KEY (product_id)
                REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created stock_alert_subscriptions\n";
}

if (!columnExists($pdo, 'products', 'requires_custom_proof')) {
    $pdo->exec('ALTER TABLE products ADD COLUMN requires_custom_proof TINYINT(1) NOT NULL DEFAULT 0 AFTER badge_label');
    echo "added products.requires_custom_proof\n";
}

if (!columnExists($pdo, 'orders', 'notify_whatsapp')) {
    $pdo->exec('ALTER TABLE orders ADD COLUMN notify_whatsapp TINYINT(1) NOT NULL DEFAULT 0 AFTER notes');
    echo "added orders.notify_whatsapp\n";
}

if (!tableExists($pdo, 'order_customizations')) {
    $pdo->exec(
        'CREATE TABLE order_customizations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            order_id BIGINT UNSIGNED NOT NULL,
            order_item_id BIGINT UNSIGNED DEFAULT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            file_path VARCHAR(500) DEFAULT NULL,
            label_text VARCHAR(500) DEFAULT NULL,
            instructions TEXT DEFAULT NULL,
            status ENUM(\'pending\',\'approved\',\'rejected\') NOT NULL DEFAULT \'pending\',
            admin_note TEXT DEFAULT NULL,
            reviewed_by BIGINT UNSIGNED DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_customizations_status (status, created_at),
            KEY idx_customizations_order (order_id),
            CONSTRAINT fk_customizations_order FOREIGN KEY (order_id)
                REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created order_customizations\n";
}

echo "Phase F migration complete.\n";
