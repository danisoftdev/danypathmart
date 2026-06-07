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

$companyCols = [
    'repeat_club_discount_enabled' => 'ALTER TABLE company_settings ADD COLUMN repeat_club_discount_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'repeat_club_discount_mode'    => "ALTER TABLE company_settings ADD COLUMN repeat_club_discount_mode ENUM('percent','free_local_delivery') NOT NULL DEFAULT 'percent'",
    'repeat_club_discount_percent' => 'ALTER TABLE company_settings ADD COLUMN repeat_club_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00',
    'referral_credit_enabled'      => 'ALTER TABLE company_settings ADD COLUMN referral_credit_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'referral_credit_amount'       => 'ALTER TABLE company_settings ADD COLUMN referral_credit_amount DECIMAL(12,2) NOT NULL DEFAULT 10.00',
];

foreach ($companyCols as $col => $sql) {
    if (!columnExists($pdo, 'company_settings', $col)) {
        $pdo->exec($sql);
        echo "added company_settings.{$col}\n";
    }
}

$orderCols = [
    'discount_amount'    => 'ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total',
    'discount_label'   => 'ALTER TABLE orders ADD COLUMN discount_label VARCHAR(120) DEFAULT NULL AFTER discount_amount',
    'referral_code_used' => 'ALTER TABLE orders ADD COLUMN referral_code_used VARCHAR(20) DEFAULT NULL AFTER discount_label',
    'referrer_user_id' => 'ALTER TABLE orders ADD COLUMN referrer_user_id BIGINT UNSIGNED DEFAULT NULL AFTER referral_code_used',
];

foreach ($orderCols as $col => $sql) {
    if (!columnExists($pdo, 'orders', $col)) {
        $pdo->exec($sql);
        echo "added orders.{$col}\n";
    }
}

if (!columnExists($pdo, 'users', 'referral_code')) {
    $pdo->exec('ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) DEFAULT NULL AFTER phone');
    $pdo->exec('ALTER TABLE users ADD UNIQUE KEY uq_users_referral_code (referral_code)');
    echo "added users.referral_code\n";
}

if (!tableExists($pdo, 'referral_credits')) {
    $pdo->exec(
        'CREATE TABLE referral_credits (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            referrer_user_id BIGINT UNSIGNED NOT NULL,
            referred_user_id BIGINT UNSIGNED NOT NULL,
            order_id BIGINT UNSIGNED NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_referral_pair (referrer_user_id, referred_user_id),
            KEY idx_referral_order (order_id),
            CONSTRAINT fk_referral_referrer FOREIGN KEY (referrer_user_id)
                REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_referral_referred FOREIGN KEY (referred_user_id)
                REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_referral_order FOREIGN KEY (order_id)
                REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    echo "created referral_credits\n";
}

if (columnExists($pdo, 'wallet_transactions', 'type')) {
    try {
        $pdo->exec(
            "ALTER TABLE wallet_transactions MODIFY type
             ENUM('refund','admin_credit','admin_debit','order_payment','adjustment','referral_credit') NOT NULL"
        );
        echo "extended wallet_transactions.type\n";
    } catch (\Throwable) {
        echo "wallet_transactions.type enum skipped\n";
    }
}

echo "Phase G migration complete.\n";
