<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_categories');

$pdo = Database::pdo();
$categoryId = (int) ($_GET['id'] ?? 0);
if ($categoryId <= 0) {
    Response::error('Category not found.', 404);
}

$stmt = $pdo->prepare('SELECT id FROM categories WHERE id = ?');
$stmt->execute([$categoryId]);
if ($stmt->fetch() === false) {
    Response::error('Category not found.', 404);
}

$child = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE parent_id = ?');
$child->execute([$categoryId]);
if ((int) $child->fetchColumn() > 0) {
    Response::error('Remove or reassign subcategories first.', 409);
}

$prod = $pdo->prepare('SELECT COUNT(*) FROM products WHERE category_id = ?');
$prod->execute([$categoryId]);
if ((int) $prod->fetchColumn() > 0) {
    Response::error('Reassign products before deleting this category.', 409);
}

$pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$categoryId]);

Response::success(['message' => 'Category deleted.', 'id' => $categoryId]);
