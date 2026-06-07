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

$email = 'test@danypathmart.store';
$password = 'DanyPath@Customer2025!';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND role = ?');
$stmt->execute([$email, 'customer']);
$id = $stmt->fetchColumn();

if ($id === false) {
    $pdo->prepare(
        'INSERT INTO users (name, username, email, password_hash, role, status, preferred_currency, totp_enabled)
         VALUES (?, ?, ?, ?, \'customer\', \'verified\', \'GHS\', 0)'
    )->execute(['Test Customer', 'testcustomer', $email, $hash]);
    echo "Created test customer.\n";
} else {
    $pdo->prepare('UPDATE users SET password_hash = ?, status = \'verified\' WHERE id = ?')
        ->execute([$hash, (int) $id]);
    echo "Updated test customer password.\n";
}

echo "Email: {$email}\nPassword: {$password}\n";
