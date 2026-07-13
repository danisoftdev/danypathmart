<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopPromoService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Product not found.', 404);
}

$pdo = Database::pdo();
$chk = $pdo->prepare('SELECT id, listing_status FROM products WHERE id = ? AND shop_id = ?');
$chk->execute([$id, $ctx['shop_id']]);
$existing = $chk->fetch();
if ($existing === false) {
    Response::error('Product not found.', 404);
}

$body = Response::body();
if (!empty($body['is_preorder'])) {
    Response::error('Marketplace shops cannot list pre-order / air freight products.', 422);
}

$name = trim((string) ($body['name'] ?? ''));
$price = isset($body['price']) ? (float) $body['price'] : null;
$wasRejected = ($existing['listing_status'] ?? '') === 'rejected';

$fields = [];
$params = [];
if ($name !== '') {
    $fields[] = 'name = ?';
    $params[] = $name;
}
if ($price !== null && $price >= 0) {
    $fields[] = 'price = ?';
    $params[] = $price;
}
if (isset($body['description'])) {
    $fields[] = 'description = ?';
    $params[] = trim((string) $body['description']) ?: null;
}
if (isset($body['stock_qty'])) {
    $fields[] = 'stock_qty = ?';
    $params[] = max(0, (int) $body['stock_qty']);
}
if (isset($body['category_id'])) {
    $fields[] = 'category_id = ?';
    $params[] = !empty($body['category_id']) ? (int) $body['category_id'] : null;
}
if (isset($body['images']) && is_array($body['images'])) {
    $fields[] = 'images = ?';
    $params[] = json_encode(array_slice(array_values($body['images']), 0, 5));
}
if (array_key_exists('shop_badge_label', $body) || array_key_exists('shop_promo_free_delivery', $body)) {
    $promo = ShopPromoService::parseInput($body);
    $fields[] = 'shop_badge_label = ?';
    $params[] = $promo['shop_badge_label'];
    $fields[] = 'shop_promo_free_delivery = ?';
    $params[] = $promo['shop_promo_free_delivery'];
}

// Stay / return live after seller edits; admin can unpublish later.
$fields[] = "listing_status = 'approved'";
$fields[] = "status = 'active'";

if ($fields === []) {
    Response::success(['message' => 'Nothing to update.', 'id' => $id]);
}

$params[] = $id;
$params[] = $ctx['shop_id'];

$sql = 'UPDATE products SET ' . implode(', ', $fields);
try {
    $pdo->prepare($sql . ', listing_admin_note = NULL WHERE id = ? AND shop_id = ?')->execute($params);
} catch (\Throwable) {
    $pdo->prepare($sql . ' WHERE id = ? AND shop_id = ?')->execute($params);
}

Response::success([
    'message' => $wasRejected
        ? 'Product updated and published again on your store.'
        : 'Product updated.',
    'id' => $id,
]);
