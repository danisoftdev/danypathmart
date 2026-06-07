<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$body = Response::body();

$name = trim((string) ($body['name'] ?? ''));
$price = isset($body['price']) ? (float) $body['price'] : -1;
if ($name === '' || $price < 0) {
    Response::error('Name and price are required.', 422);
}

$slug = trim((string) ($body['slug'] ?? ''));
if ($slug === '') {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '');
    $slug = trim($slug, '-');
}

$check = $pdo->prepare('SELECT id FROM products WHERE slug = ?');
$check->execute([$slug]);
if ($check->fetch() !== false) {
    $slug .= '-' . time();
}

$images = $body['images'] ?? [];
$tags = $body['tags'] ?? [];
if (!is_array($images)) {
    $images = [];
}
$images = array_slice(array_values(array_filter($images, static fn ($u) => is_string($u) && trim($u) !== '')), 0, 5);
if (!is_array($tags)) {
    $tags = [];
}

$stmt = $pdo->prepare(
    'INSERT INTO products (category_id, name, slug, description, price, cost_price, compare_at_price,
                           rating_avg, rating_count, badge_label, is_featured, is_flash_deal,
                           stock_qty, images, tags, is_preorder, origin_country, estimated_arrival_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$compareAt = isset($body['compare_at_price']) && $body['compare_at_price'] !== '' && $body['compare_at_price'] !== null
    ? (float) $body['compare_at_price']
    : null;
$ratingAvg = isset($body['rating_avg']) && $body['rating_avg'] !== '' && $body['rating_avg'] !== null
    ? (float) $body['rating_avg']
    : null;

$stmt->execute([
    !empty($body['category_id']) ? (int) $body['category_id'] : null,
    $name,
    $slug,
    trim((string) ($body['description'] ?? '')) ?: null,
    $price,
    max(0, (float) ($body['cost_price'] ?? 0)),
    $compareAt,
    $ratingAvg,
    max(0, (int) ($body['rating_count'] ?? 0)),
    trim((string) ($body['badge_label'] ?? '')) ?: null,
    !empty($body['is_featured']) ? 1 : 0,
    !empty($body['is_flash_deal']) ? 1 : 0,
    max(0, (int) ($body['stock_qty'] ?? 0)),
    json_encode(array_values($images), JSON_UNESCAPED_SLASHES),
    json_encode(array_values($tags), JSON_UNESCAPED_SLASHES),
    !empty($body['is_preorder']) ? 1 : 0,
    trim((string) ($body['origin_country'] ?? '')) ?: null,
    isset($body['estimated_arrival_days']) ? (int) $body['estimated_arrival_days'] : null,
    in_array($body['status'] ?? 'active', ['active', 'inactive', 'draft'], true) ? $body['status'] : 'active',
]);

$id = (int) $pdo->lastInsertId();
$row = $pdo->prepare('SELECT * FROM products WHERE id = ?');
$row->execute([$id]);
$product = $row->fetch();

Response::success([
    'message' => 'Product created.',
    'product' => ProductPresenter::full($product),
], 201);
