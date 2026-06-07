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

$orderStatusEnum = "'placed','payment_confirmed','pending','processing','shipped','out_for_delivery','delivered','cancelled'";

if (!columnExists($pdo, 'orders', 'cancelled_by')) {
    $pdo->exec("ALTER TABLE orders ADD COLUMN cancelled_by ENUM('customer','admin') DEFAULT NULL AFTER notes");
    echo "added orders.cancelled_by\n";
}
if (!columnExists($pdo, 'orders', 'cancel_reason')) {
    $pdo->exec('ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(500) DEFAULT NULL AFTER cancelled_by');
    echo "added orders.cancel_reason\n";
}

$pdo->exec("ALTER TABLE orders MODIFY status ENUM({$orderStatusEnum}) NOT NULL DEFAULT 'placed'");
echo "updated orders.status enum\n";

$pdo->exec("ALTER TABLE order_tracking MODIFY status ENUM({$orderStatusEnum}) NOT NULL");
echo "updated order_tracking.status enum\n";

echo "Order pending/cancel migration complete.\n";
