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
use App\Helpers\WeeklyExportService;

$pdo = Database::pdo();
$result = WeeklyExportService::runScheduled($pdo);

if (PHP_SAPI === 'cli') {
    echo json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL;
    exit(($result['skipped'] ?? false) || ($result['sent'] ?? false) ? 0 : 1);
}

header('Content-Type: application/json');
echo json_encode($result);
