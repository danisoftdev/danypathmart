<?php

declare(strict_types=1);

/**
 * POS schema smoke test — verifies migration 057 tables/columns exist.
 *
 * Usage: php backend/scripts/pos-smoke-test.php
 */

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

$pdo = Database::pdo();
$db = $pdo->query('SELECT DATABASE()')->fetchColumn();

$requiredTables = ['pos_locations', 'pos_registers', 'pos_shifts', 'pos_order_payments'];
$requiredColumns = [
    'company_settings' => ['pos_module_enabled', 'pos_supervisor_pin_hash'],
    'products'         => ['barcode'],
    'orders'           => ['sales_channel', 'pos_shift_id', 'pos_change_given'],
];

echo "POS schema smoke test (database: {$db})\n" . str_repeat('-', 50) . "\n";

$failed = 0;

foreach ($requiredTables as $table) {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
    );
    $stmt->execute([$db, $table]);
    $ok = (int) $stmt->fetchColumn() > 0;
    if (!$ok) {
        $failed++;
    }
    echo ($ok ? '  OK ' : ' FAIL ') . "table {$table}\n";
}

foreach ($requiredColumns as $table => $cols) {
    foreach ($cols as $col) {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$db, $table, $col]);
        $ok = (int) $stmt->fetchColumn() > 0;
        if (!$ok) {
            $failed++;
        }
        echo ($ok ? '  OK ' : ' FAIL ') . "{$table}.{$col}\n";
    }
}

echo "\n" . ($failed === 0 ? "POS schema OK.\n" : "{$failed} check(s) failed — run migration 057_pos_dpm.sql\n");
exit($failed > 0 ? 1 : 0);
