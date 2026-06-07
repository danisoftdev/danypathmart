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
$name = trim((string) ($body['name'] ?? ''));
$price = isset($body['price']) ? (float) $body['price'] : null;

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
if (isset($body['images']) && is_array($body['images'])) {
    $fields[] = 'images = ?';
    $params[] = json_encode(array_slice($body['images'], 0, 5));
}
if (array_key_exists('shop_badge_label', $body) || array_key_exists('shop_promo_free_delivery', $body)) {
    $promo = ShopPromoService::parseInput($body);
    $fields[] = 'shop_badge_label = ?';
    $params[] = $promo['shop_badge_label'];
    $fields[] = 'shop_promo_free_delivery = ?';
    $params[] = $promo['shop_promo_free_delivery'];
}

if ($fields !== []) {
    if (($existing['listing_status'] ?? '') === 'approved') {
        $fields[] = "listing_status = 'pending'";
        $fields[] = "status = 'inactive'";
    }
    $params[] = $id;
    $params[] = $ctx['shop_id'];
    $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ? AND shop_id = ?')->execute($params);
}

Response::success(['message' => 'Product updated.', 'id' => $id]);
