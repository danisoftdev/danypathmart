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
$sql = file_get_contents(__DIR__ . '/../../database/migrations/007_ghs_only.sql');
if ($sql === false) {
    fwrite(STDERR, "Could not read migration.\n");
    exit(1);
}
$pdo->exec($sql);
echo "GHS-only currency migration complete.\n";
