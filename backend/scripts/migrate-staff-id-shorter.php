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
$sql = file_get_contents(__DIR__ . '/../../database/migrations/042_staff_id_shorter_digits.sql');
if ($sql !== false) {
    $pdo->exec(trim($sql));
    echo "Updated existing staff IDs to 4-digit format.\n";
}

foreach ($pdo->query('SELECT staff_id FROM employees ORDER BY id')->fetchAll(PDO::FETCH_COLUMN) as $id) {
    echo "  {$id}\n";
}
