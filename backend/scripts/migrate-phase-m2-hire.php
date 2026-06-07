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
use App\Helpers\StaffPermission;

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

if (!columnExists($pdo, 'job_applications', 'hired_user_id')) {
    try {
        $pdo->exec('ALTER TABLE job_applications ADD COLUMN hired_user_id BIGINT UNSIGNED DEFAULT NULL AFTER user_id');
        echo "Added job_applications.hired_user_id\n";
    } catch (\Throwable $e) {
        echo "Note hired_user_id: {$e->getMessage()}\n";
    }
}

if (!columnExists($pdo, 'job_applications', 'hired_at')) {
    try {
        $pdo->exec('ALTER TABLE job_applications ADD COLUMN hired_at TIMESTAMP NULL DEFAULT NULL AFTER hired_user_id');
        echo "Added job_applications.hired_at\n";
    } catch (\Throwable $e) {
        echo "Note hired_at: {$e->getMessage()}\n";
    }
}

$sql = file_get_contents(__DIR__ . '/../../database/migrations/033_position_permissions_hire.sql');
if ($sql !== false) {
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement === '' || str_starts_with(strtoupper($statement), 'ALTER TABLE job_applications')) {
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

if ($pdo->query("SHOW TABLES LIKE 'position_permission_templates'")->fetch()) {
    $roles = $pdo->query('SELECT slug FROM job_role_types')->fetchAll(PDO::FETCH_COLUMN);
    $insert = $pdo->prepare(
        'INSERT IGNORE INTO position_permission_templates (role_slug, permissions) VALUES (?, ?)'
    );
    $empty = json_encode(StaffPermission::defaults(false));
    foreach ($roles as $slug) {
        $insert->execute([(string) $slug, $empty]);
    }
    echo "Seeded position permission templates.\n";
}

echo "Phase M2 hire & position permissions migration complete.\n";
