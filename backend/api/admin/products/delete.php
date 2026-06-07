<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('delete_products');

$pdo = Database::pdo();
$productId = (int) ($_GET['id'] ?? 0);
if ($productId <= 0) {
    Response::error('Product not found.', 404);
}

$stmt = $pdo->prepare('SELECT id FROM products WHERE id = ?');
$stmt->execute([$productId]);
if ($stmt->fetch() === false) {
    Response::error('Product not found.', 404);
}

$pdo->prepare("UPDATE products SET status = 'inactive' WHERE id = ?")->execute([$productId]);

Response::success(['message' => 'Product deactivated.', 'id' => $productId]);
