<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'approve_shop_listings', 'add_edit_products']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Product not found.', 404);
}

$pdo = Database::pdo();
$body = Response::body();
$action = trim((string) ($body['action'] ?? 'approve'));

$stmt = $pdo->prepare('SELECT id, shop_id FROM products WHERE id = ? AND shop_id IS NOT NULL');
$stmt->execute([$id]);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Marketplace listing not found.', 404);
}

if ($action === 'reject') {
    $pdo->prepare("UPDATE products SET listing_status = 'rejected', status = 'inactive' WHERE id = ?")->execute([$id]);
    Response::success(['message' => 'Listing rejected.', 'id' => $id]);
}

$pdo->prepare("UPDATE products SET listing_status = 'approved', status = 'active' WHERE id = ?")->execute([$id]);
Response::success(['message' => 'Listing approved and live.', 'id' => $id]);
