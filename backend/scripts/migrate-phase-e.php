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

if (!tableExists($pdo, 'quotes')) {
    $pdo->exec(
        'CREATE TABLE quotes (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            quote_number VARCHAR(32) NOT NULL,
            organization_name VARCHAR(200) NOT NULL,
            contact_name VARCHAR(120) NOT NULL,
            contact_email VARCHAR(180) NOT NULL,
            contact_phone VARCHAR(40) DEFAULT NULL,
            status ENUM(\'requested\',\'proforma_sent\',\'approved_pay_later\',\'converted\',\'rejected\')
                NOT NULL DEFAULT \'requested\',
            subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
            intl_shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
            local_delivery_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
            local_delivery_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
            total DECIMAL(12,2) NOT NULL DEFAULT 0,
            customer_notes TEXT DEFAULT NULL,
            admin_notes TEXT DEFAULT NULL,
            proforma_note TEXT DEFAULT NULL,
            valid_until DATE DEFAULT NULL,
            proforma_sent_at DATETIME DEFAULT NULL,
            approved_at DATETIME DEFAULT NULL,
            converted_order_id BIGINT UNSIGNED DEFAULT NULL,
            reviewed_by BIGINT UNSIGNED DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_quotes_number (quote_number),
            KEY idx_quotes_user (user_id, created_at),
            KEY idx_quotes_status (status, created_at),
            CONSTRAINT fk_quotes_user FOREIGN KEY (user_id)
                REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created quotes\n";
}

if (!tableExists($pdo, 'quote_items')) {
    $pdo->exec(
        'CREATE TABLE quote_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            quote_id BIGINT UNSIGNED NOT NULL,
            product_id BIGINT UNSIGNED NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(12,2) DEFAULT NULL,
            recipient_name VARCHAR(120) DEFAULT NULL,
            size_label VARCHAR(40) DEFAULT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_quote_items_quote (quote_id, sort_order),
            CONSTRAINT fk_quote_items_quote FOREIGN KEY (quote_id)
                REFERENCES quotes (id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_quote_items_product FOREIGN KEY (product_id)
                REFERENCES products (id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created quote_items\n";
}

$orderCols = [
    ['order_type', "ALTER TABLE orders ADD COLUMN order_type ENUM('retail','group','institutional') NOT NULL DEFAULT 'retail' AFTER notes"],
    ['organization_name', 'ALTER TABLE orders ADD COLUMN organization_name VARCHAR(200) DEFAULT NULL AFTER order_type'],
    ['quote_id', 'ALTER TABLE orders ADD COLUMN quote_id BIGINT UNSIGNED DEFAULT NULL AFTER organization_name'],
    ['po_reference', 'ALTER TABLE orders ADD COLUMN po_reference VARCHAR(120) DEFAULT NULL AFTER quote_id'],
];
foreach ($orderCols as [$col, $sql]) {
    if (!columnExists($pdo, 'orders', $col)) {
        $pdo->exec($sql);
        echo "added orders.{$col}\n";
    }
}

$itemCols = [
    ['recipient_name', 'ALTER TABLE order_items ADD COLUMN recipient_name VARCHAR(120) DEFAULT NULL AFTER estimated_arrival'],
    ['size_label', 'ALTER TABLE order_items ADD COLUMN size_label VARCHAR(40) DEFAULT NULL AFTER recipient_name'],
];
foreach ($itemCols as [$col, $sql]) {
    if (!columnExists($pdo, 'order_items', $col)) {
        $pdo->exec($sql);
        echo "added order_items.{$col}\n";
    }
}

$companyCols = [
    ['quotes_enabled', 'ALTER TABLE company_settings ADD COLUMN quotes_enabled TINYINT(1) NOT NULL DEFAULT 1'],
    ['institutional_pay_later_enabled', 'ALTER TABLE company_settings ADD COLUMN institutional_pay_later_enabled TINYINT(1) NOT NULL DEFAULT 1'],
];
foreach ($companyCols as [$col, $sql]) {
    if (!columnExists($pdo, 'company_settings', $col)) {
        $pdo->exec($sql);
        echo "added company_settings.{$col}\n";
    }
}

echo "Phase E group/institutional migration complete.\n";
