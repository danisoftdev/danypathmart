<?php

declare(strict_types=1);

/** Dev fixture: one active shop + approved product for self-delivery tests. */

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
use App\Config\Env;

Env::load();
$pdo = Database::pdo();

$existing = (int) $pdo->query(
    "SELECT COUNT(*) FROM products WHERE shop_id IS NOT NULL AND listing_status = 'approved' AND status = 'active'"
)->fetchColumn();
if ($existing > 0) {
    echo "Already have {$existing} approved shop product(s).\n";
    exit(0);
}

$userId = (int) $pdo->query("SELECT id FROM users WHERE role IN ('customer','admin') ORDER BY id ASC LIMIT 1")->fetchColumn();
if ($userId <= 0) {
    fwrite(STDERR, "No user found.\n");
    exit(1);
}

$pdo->prepare(
    "INSERT INTO shops (name, slug, contact_email, city, status, is_published)
     VALUES (?, ?, ?, ?, 'active', 1)"
)->execute(['Test Seller Shop', 'test-seller-shop', 'testseller@example.com', 'Accra']);
$shopId = (int) $pdo->lastInsertId();

$pdo->prepare('INSERT IGNORE INTO shop_members (shop_id, user_id, role) VALUES (?, ?, ?)')
    ->execute([$shopId, $userId, 'owner']);

$pdo->prepare(
    "INSERT INTO products (name, slug, price, stock_qty, status, listing_status, shop_id, images)
     VALUES (?, ?, ?, ?, 'active', 'approved', ?, ?)"
)->execute([
    'Test Shop T-Shirt',
    'test-shop-t-shirt-' . $shopId,
    45.00,
    50,
    $shopId,
    json_encode(['/uploads/placeholder.png']),
]);

$productId = (int) $pdo->lastInsertId();
echo "Created shop #{$shopId} and product #{$productId} (Test Shop T-Shirt).\n";
