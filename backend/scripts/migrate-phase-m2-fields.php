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
$sql = file_get_contents(__DIR__ . '/../../database/migrations/031_job_post_fields.sql');
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
        } elseif (str_starts_with(strtoupper($statement), 'ALTER TABLE')) {
            echo "Applied schema alter on job_applications\n";
        }
    } catch (\Throwable $e) {
        echo "Note: {$e->getMessage()}\n";
    }
}

if (tableExists($pdo, 'job_post_fields') && tableExists($pdo, 'job_posts')) {
    $posts = $pdo->query('SELECT id FROM job_posts')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($posts as $postId) {
        $postId = (int) $postId;
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM job_post_fields WHERE job_post_id = ?');
        $stmt->execute([$postId]);
        if ((int) $stmt->fetchColumn() === 0) {
            CareerService::insertDefaultFields($pdo, $postId);
            echo "Seeded default fields for job post #{$postId}\n";
        }
    }
}

echo "Phase M2 fields migration complete.\n";
