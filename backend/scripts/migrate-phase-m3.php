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

$sql = file_get_contents(__DIR__ . '/../../database/migrations/034_pickup_stations_m3.sql');
if ($sql !== false) {
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
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

if (!columnExists($pdo, 'orders', 'pickup_station_id')) {
    try {
        $pdo->exec(
            'ALTER TABLE orders ADD COLUMN pickup_station_id BIGINT UNSIGNED DEFAULT NULL AFTER address_id'
        );
        echo "Added orders.pickup_station_id\n";
    } catch (\Throwable $e) {
        echo "Note pickup_station_id: {$e->getMessage()}\n";
    }
}

if (!columnExists($pdo, 'orders', 'pickup_station_snapshot')) {
    try {
        $pdo->exec(
            'ALTER TABLE orders ADD COLUMN pickup_station_snapshot JSON DEFAULT NULL AFTER pickup_station_id'
        );
        echo "Added orders.pickup_station_snapshot\n";
    } catch (\Throwable $e) {
        echo "Note pickup_station_snapshot: {$e->getMessage()}\n";
    }
}

try {
    $pdo->exec(
        'ALTER TABLE orders ADD CONSTRAINT fk_orders_pickup_station FOREIGN KEY (pickup_station_id)
         REFERENCES pickup_stations (id) ON DELETE SET NULL ON UPDATE CASCADE'
    );
    echo "Added fk_orders_pickup_station\n";
} catch (\Throwable $e) {
    echo "Note FK: {$e->getMessage()}\n";
}

$orderStatusEnum = "'placed','payment_confirmed','pending','processing','shipped','out_for_delivery','delivered','sent_to_station','ready_for_pickup','collected','cancelled'";

$pdo->exec("ALTER TABLE orders MODIFY status ENUM({$orderStatusEnum}) NOT NULL DEFAULT 'placed'");
echo "Updated orders.status enum\n";

$pdo->exec("ALTER TABLE order_tracking MODIFY status ENUM({$orderStatusEnum}) NOT NULL");
echo "Updated order_tracking.status enum\n";

echo "Phase M3 pickup stations migration complete.\n";
