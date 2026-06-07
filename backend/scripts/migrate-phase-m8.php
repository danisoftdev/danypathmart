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

$sql = file_get_contents(__DIR__ . '/../../database/migrations/040_station_repack_m8.sql');
if ($sql !== false) {
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement === '') {
            continue;
        }
        try {
            $pdo->exec($statement);
            echo "OK: " . substr(str_replace("\n", ' ', $statement), 0, 70) . "…\n";
        } catch (\Throwable $e) {
            echo "Skip/note: {$e->getMessage()}\n";
        }
    }
}

if (!columnExists($pdo, 'users', 'assigned_pickup_station_id')) {
    echo "WARNING: users.assigned_pickup_station_id missing — check migration output.\n";
}

if (!tableExists($pdo, 'station_repack_logs')) {
    echo "WARNING: station_repack_logs table missing — check migration output.\n";
}

echo "Phase M8 station repack migration complete.\n";
