<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
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
$note = trim((string) ($body['note'] ?? $body['admin_note'] ?? ''));

$stmt = $pdo->prepare(
    'SELECT p.id, p.name, p.shop_id, p.slug, p.price, s.name AS shop_name
     FROM products p
     INNER JOIN shops s ON s.id = p.shop_id
     WHERE p.id = ? AND p.shop_id IS NOT NULL'
);
$stmt->execute([$id]);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Marketplace listing not found.', 404);
}

$product = [
    'id'      => (int) $row['id'],
    'name'    => (string) $row['name'],
    'shop_id' => (int) $row['shop_id'],
    'slug'    => (string) ($row['slug'] ?? ''),
    'price'   => (float) ($row['price'] ?? 0),
];

if ($action === 'reject') {
    $pdo->prepare("UPDATE products SET listing_status = 'rejected', status = 'inactive' WHERE id = ?")
        ->execute([$id]);
    NotificationService::notifyProductListingDecision($pdo, $product, 'reject', $note !== '' ? $note : null);
    Response::success(['message' => 'Listing rejected.', 'id' => $id]);
}

$pdo->prepare("UPDATE products SET listing_status = 'approved', status = 'active' WHERE id = ?")
    ->execute([$id]);
NotificationService::notifyProductListingDecision($pdo, $product, 'approve', $note !== '' ? $note : null);
Response::success(['message' => 'Listing approved and live.', 'id' => $id]);
