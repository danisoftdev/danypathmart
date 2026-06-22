<?php

declare(strict_types=1);

/** One-off apply migration 053 (workaround: migrate-all skips statements bundled with leading comments). */

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
use App\Config\Env;

Env::load();
$pdo = Database::pdo();

$statements = [
    "CREATE TABLE IF NOT EXISTS shop_order_fulfillments (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id        BIGINT UNSIGNED NOT NULL,
        shop_id         BIGINT UNSIGNED NOT NULL,
        status          ENUM('awaiting_payment','paid','preparing','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'awaiting_payment',
        subtotal        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
        created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_shop_order_fulfillment (order_id, shop_id),
        KEY idx_shop_fulfillment_shop (shop_id, status),
        CONSTRAINT fk_shop_fulfillment_order FOREIGN KEY (order_id)
            REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_shop_fulfillment_shop FOREIGN KEY (shop_id)
            REFERENCES shops (id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    "CREATE TABLE IF NOT EXISTS shop_fulfillment_tracking (
        id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        fulfillment_id  BIGINT UNSIGNED NOT NULL,
        status          VARCHAR(40)     NOT NULL,
        note            TEXT            DEFAULT NULL,
        updated_by      BIGINT UNSIGNED DEFAULT NULL,
        created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_shop_fulfillment_tracking (fulfillment_id, id),
        CONSTRAINT fk_shop_fulfillment_tracking FOREIGN KEY (fulfillment_id)
            REFERENCES shop_order_fulfillments (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_shop_fulfillment_tracking_user FOREIGN KEY (updated_by)
            REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    "UPDATE company_settings SET shop_earnings_release_on = 'paid' WHERE shop_earnings_release_on = 'collected'",
];

foreach ($statements as $sql) {
    try {
        $pdo->exec($sql);
        echo "OK\n";
    } catch (Throwable $e) {
        echo 'ERR: ' . $e->getMessage() . "\n";
    }
}

echo "Done.\n";
