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
use App\Helpers\EmployeeService;

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

$sql = file_get_contents(__DIR__ . '/../../database/migrations/041_employee_staff_ids.sql');
if ($sql !== false) {
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement === '') {
            continue;
        }
        try {
            $pdo->exec($statement);
            echo 'OK: ' . substr(str_replace("\n", ' ', $statement), 0, 70) . "…\n";
        } catch (Throwable $e) {
            echo "Skip/note: {$e->getMessage()}\n";
        }
    }
}

if (!tableExists($pdo, 'employees')) {
    echo "WARNING: employees table missing — check migration output.\n";
    exit(1);
}

$backfilled = EmployeeService::backfillExistingWorkforce($pdo);
echo "Backfilled {$backfilled} workforce employee record(s).\n";
echo "Phase H0 employee staff IDs migration complete.\n";
