<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Product slug is required', 422);
}

$pdo = Database::pdo();

$stmt = $pdo->prepare(
    "SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.status = 'active'
     LIMIT 1"
);
$stmt->execute([$slug]);
$row = $stmt->fetch();

if (!$row) {
    Response::error('Product not found', 404, ['code' => 'product_not_found']);
}

$product = ProductPresenter::full($row);
$product['category'] = $row['category_name'] !== null
    ? ['id' => (int) $row['category_id'], 'name' => $row['category_name'], 'slug' => $row['category_slug']]
    : null;

Response::success(['data' => $product]);
