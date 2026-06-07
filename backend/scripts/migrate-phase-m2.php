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

$pdo = Database::pdo();
$sql = file_get_contents(__DIR__ . '/../../database/migrations/030_job_careers_m2.sql');
if ($sql === false) {
    fwrite(STDERR, "Could not read migration SQL.\n");
    exit(1);
}

foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
    if ($statement === '') {
        continue;
    }
    $pdo->exec($statement);
    if (preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $statement, $m) === 1) {
        echo "Ensured table {$m[1]}\n";
    }
}

echo "Phase M2 migration complete.\n";
