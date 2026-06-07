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

$companyCols = [
    ['bank_name', "ALTER TABLE company_settings ADD COLUMN bank_name VARCHAR(120) DEFAULT NULL AFTER pay_before_delivery"],
    ['bank_account_name', "ALTER TABLE company_settings ADD COLUMN bank_account_name VARCHAR(120) DEFAULT NULL AFTER bank_name"],
    ['bank_account_number', "ALTER TABLE company_settings ADD COLUMN bank_account_number VARCHAR(40) DEFAULT NULL AFTER bank_account_name"],
];
foreach ($companyCols as [$col, $sql]) {
    if (!columnExists($pdo, 'company_settings', $col)) {
        $pdo->exec($sql);
        echo "added company_settings.{$col}\n";
    }
}

$orderCols = [
    ['payment_method', "ALTER TABLE orders ADD COLUMN payment_method ENUM('paystack','wallet','wallet_paystack','bank_transfer','pod') DEFAULT NULL AFTER payment_ref"],
    ['wallet_paid', "ALTER TABLE orders ADD COLUMN wallet_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER payment_method"],
    ['bank_transfer_ref', "ALTER TABLE orders ADD COLUMN bank_transfer_ref VARCHAR(120) DEFAULT NULL AFTER wallet_paid"],
    ['bank_transfer_submitted_at', "ALTER TABLE orders ADD COLUMN bank_transfer_submitted_at TIMESTAMP NULL DEFAULT NULL AFTER bank_transfer_ref"],
];
foreach ($orderCols as [$col, $sql]) {
    if (!columnExists($pdo, 'orders', $col)) {
        $pdo->exec($sql);
        echo "added orders.{$col}\n";
    }
}

echo "Phase B checkout migration complete.\n";
