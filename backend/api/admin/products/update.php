<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Helpers\RestockAlertService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$productId = (int) ($_GET['id'] ?? 0);
if ($productId <= 0) {
    Response::error('Product not found.', 404);
}

$stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
$stmt->execute([$productId]);
$existing = $stmt->fetch();
if ($existing === false) {
    Response::error('Product not found.', 404);
}

$body = Response::body();
$fields = [];
$params = [];

$map = [
    'name' => 'name', 'slug' => 'slug', 'description' => 'description',
    'price' => 'price', 'cost_price' => 'cost_price', 'compare_at_price' => 'compare_at_price',
    'rating_avg' => 'rating_avg', 'rating_count' => 'rating_count', 'badge_label' => 'badge_label',
    'is_featured' => 'is_featured', 'is_flash_deal' => 'is_flash_deal',
    'stock_qty' => 'stock_qty', 'category_id' => 'category_id',
    'is_preorder' => 'is_preorder', 'estimated_arrival_days' => 'estimated_arrival_days',
    'origin_country' => 'origin_country', 'status' => 'status',
    'size_guide_id' => 'size_guide_id',
    'requires_custom_proof' => 'requires_custom_proof',
];

foreach ($map as $key => $col) {
    if (!array_key_exists($key, $body)) {
        continue;
    }
    $val = $body[$key];
    if ($key === 'price' || $key === 'cost_price' || $key === 'compare_at_price' || $key === 'rating_avg') {
        $val = $val === null || $val === '' ? null : (float) $val;
    } elseif ($key === 'rating_count') {
        $val = $val === null || $val === '' ? 0 : (int) $val;
    } elseif ($key === 'stock_qty' || $key === 'category_id' || $key === 'estimated_arrival_days' || $key === 'size_guide_id') {
        $val = $val === null || $val === '' ? null : (int) $val;
    } elseif ($key === 'is_preorder' || $key === 'is_featured' || $key === 'is_flash_deal' || $key === 'requires_custom_proof') {
        $val = !empty($val) ? 1 : 0;
    } else {
        $val = is_string($val) ? trim($val) : $val;
    }
    $fields[] = "{$col} = ?";
    $params[] = $val;
}

if (array_key_exists('images', $body) && is_array($body['images'])) {
    $images = array_slice(
        array_values(array_filter($body['images'], static fn ($u) => is_string($u) && trim($u) !== '')),
        0,
        5
    );
    $fields[] = 'images = ?';
    $params[] = json_encode($images, JSON_UNESCAPED_SLASHES);
}
if (array_key_exists('tags', $body) && is_array($body['tags'])) {
    $fields[] = 'tags = ?';
    $params[] = json_encode(array_values($body['tags']), JSON_UNESCAPED_SLASHES);
}

if ($fields === []) {
    Response::error('No fields to update.', 422);
}

$params[] = $productId;
$oldStock = (int) ($existing['stock_qty'] ?? 0);
$pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

if (array_key_exists('stock_qty', $body)) {
    $newStock = (int) $body['stock_qty'];
    RestockAlertService::notifyIfRestocked($pdo, $productId, $oldStock, $newStock);
}

$fetch = $pdo->prepare('SELECT * FROM products WHERE id = ?');
$fetch->execute([$productId]);
$product = $fetch->fetch();

Response::success([
    'message' => 'Product updated.',
    'product' => ProductPresenter::full($product),
]);
