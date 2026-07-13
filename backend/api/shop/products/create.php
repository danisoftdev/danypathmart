<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Helpers\ShopPromoService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$body = Response::body();

$name = trim((string) ($body['name'] ?? ''));
$price = isset($body['price']) ? (float) $body['price'] : -1;
if ($name === '' || $price < 0) {
    Response::error('Name and price are required.', 422);
}
if (!empty($body['is_preorder'])) {
    Response::error('Marketplace shops cannot list pre-order / air freight products. Those are DanyPathMart catalog only.', 422);
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

$images = is_array($body['images'] ?? null) ? $body['images'] : [];
$images = array_slice(array_values(array_filter($images, static fn ($u) => is_string($u) && trim($u) !== '')), 0, 5);
$promo = ShopPromoService::parseInput($body);

// Shop listings go live immediately; admin can later unpublish with a reason.
$status = 'active';
$listingStatus = 'approved';

try {
    $pdo->prepare(
        'INSERT INTO products (shop_id, category_id, name, slug, description, price, stock_qty, images,
         shop_badge_label, shop_promo_free_delivery, status, listing_status, listing_admin_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)'
    )->execute([
        $ctx['shop_id'],
        !empty($body['category_id']) ? (int) $body['category_id'] : null,
        $name,
        $slug,
        trim((string) ($body['description'] ?? '')) ?: null,
        $price,
        max(0, (int) ($body['stock_qty'] ?? 0)),
        json_encode($images),
        $promo['shop_badge_label'],
        $promo['shop_promo_free_delivery'],
        $status,
        $listingStatus,
    ]);
} catch (\Throwable) {
    $pdo->prepare(
        'INSERT INTO products (shop_id, category_id, name, slug, description, price, stock_qty, images,
         shop_badge_label, shop_promo_free_delivery, status, listing_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $ctx['shop_id'],
        !empty($body['category_id']) ? (int) $body['category_id'] : null,
        $name,
        $slug,
        trim((string) ($body['description'] ?? '')) ?: null,
        $price,
        max(0, (int) ($body['stock_qty'] ?? 0)),
        json_encode($images),
        $promo['shop_badge_label'],
        $promo['shop_promo_free_delivery'],
        $status,
        $listingStatus,
    ]);
}

$id = (int) $pdo->lastInsertId();

$shopName = (string) ($ctx['shop']['name'] ?? '');
NotificationService::notifyNewProductListingLive($pdo, [
    'id'      => $id,
    'name'    => $name,
    'shop_id' => (int) $ctx['shop_id'],
    'price'   => $price,
], $shopName);

Response::success(['message' => 'Product published to your store.', 'id' => $id], 201);
