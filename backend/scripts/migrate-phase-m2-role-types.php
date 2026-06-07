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
use App\Helpers\CareerService;

$pdo = Database::pdo();
$sql = file_get_contents(__DIR__ . '/../../database/migrations/032_job_role_types.sql');
if ($sql === false) {
    fwrite(STDERR, "Could not read migration SQL.\n");
    exit(1);
}

foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
    if ($statement === '') {
        continue;
    }
    try {
        $pdo->exec($statement);
        if (preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $statement, $m) === 1) {
            echo "Ensured table {$m[1]}\n";
        } elseif (str_starts_with(strtoupper($statement), 'INSERT')) {
            echo "Seeded job_role_types\n";
        } elseif (str_starts_with(strtoupper($statement), 'ALTER TABLE')) {
            echo "Widened job_posts.job_type to VARCHAR\n";
        }
    } catch (\Throwable $e) {
        echo "Note: {$e->getMessage()}\n";
    }
}

// Register any job_type slugs on existing posts not yet in catalog.
if ($pdo->query("SHOW TABLES LIKE 'job_role_types'")->fetch()) {
    $posts = $pdo->query('SELECT DISTINCT job_type FROM job_posts WHERE job_type IS NOT NULL AND job_type <> \'\'')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($posts as $slug) {
        CareerService::ensureRoleTypeExists($pdo, (string) $slug);
        echo "Ensured role type catalog entry: {$slug}\n";
    }
}

echo "Phase M2 role types migration complete.\n";
