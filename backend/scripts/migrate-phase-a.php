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

$columns = [
    ['company_settings', 'paystack_enabled', "ALTER TABLE company_settings ADD COLUMN paystack_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER return_policy"],
    ['company_settings', 'wallet_checkout_enabled', "ALTER TABLE company_settings ADD COLUMN wallet_checkout_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER paystack_enabled"],
    ['company_settings', 'bank_transfer_enabled', "ALTER TABLE company_settings ADD COLUMN bank_transfer_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER wallet_checkout_enabled"],
    ['company_settings', 'pod_enabled', "ALTER TABLE company_settings ADD COLUMN pod_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER bank_transfer_enabled"],
    ['company_settings', 'pay_before_delivery', "ALTER TABLE company_settings ADD COLUMN pay_before_delivery TINYINT(1) NOT NULL DEFAULT 1 AFTER pod_enabled"],
];

foreach ($columns as [$table, $column, $sql]) {
    if (columnExists($pdo, $table, $column)) {
        echo "skip {$table}.{$column}\n";
        continue;
    }
    $pdo->exec($sql);
    echo "added {$table}.{$column}\n";
}

$sqlFile = __DIR__ . '/../../database/migrations/008_wallet_payments.sql';
$raw = file_get_contents($sqlFile);
if ($raw !== false) {
    if (!tableExists($pdo, 'wallets')) {
        $pdo->exec(
            'CREATE TABLE wallets (
                user_id BIGINT UNSIGNED NOT NULL,
                balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                CONSTRAINT fk_wallets_user FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        echo "created wallets\n";
    }
    if (!tableExists($pdo, 'wallet_transactions')) {
        $pdo->exec(
            'CREATE TABLE wallet_transactions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id BIGINT UNSIGNED NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                balance_after DECIMAL(12,2) NOT NULL,
                type ENUM(\'refund\',\'admin_credit\',\'admin_debit\',\'order_payment\',\'adjustment\') NOT NULL,
                order_id BIGINT UNSIGNED DEFAULT NULL,
                note VARCHAR(500) DEFAULT NULL,
                created_by BIGINT UNSIGNED DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_wallet_tx_user (user_id, created_at),
                KEY idx_wallet_tx_order (order_id),
                CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id)
                    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT fk_wallet_tx_order FOREIGN KEY (order_id)
                    REFERENCES orders (id) ON DELETE SET NULL ON UPDATE CASCADE,
                CONSTRAINT fk_wallet_tx_admin FOREIGN KEY (created_by)
                    REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        echo "created wallet_transactions\n";
    }
}

echo "Phase A wallet/payments migration complete.\n";
