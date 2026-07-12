<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
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

$resubmitted = false;
if ($fields !== []) {
    if (($existing['listing_status'] ?? '') === 'approved') {
        $fields[] = "listing_status = 'pending'";
        $fields[] = "status = 'inactive'";
        $resubmitted = true;
    }
    $params[] = $id;
    $params[] = $ctx['shop_id'];
    $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ? AND shop_id = ?')->execute($params);
}

if ($resubmitted) {
    $prodName = $name !== '' ? $name : (string) ($existing['name'] ?? 'Product');
    if ($name === '') {
        $nStmt = $pdo->prepare('SELECT name, price FROM products WHERE id = ?');
        $nStmt->execute([$id]);
        $nRow = $nStmt->fetch();
        if ($nRow !== false) {
            $prodName = (string) $nRow['name'];
            $price = (float) $nRow['price'];
        }
    }
    NotificationService::notifyNewProductListingPending($pdo, [
        'id'      => $id,
        'name'    => $prodName,
        'shop_id' => (int) $ctx['shop_id'],
        'price'   => $price ?? 0,
    ], (string) ($ctx['shop']['name'] ?? ''));
}

Response::success(['message' => 'Product updated.', 'id' => $id]);
