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
$action = strtolower(trim((string) ($body['action'] ?? 'approve')));
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

// Aliases: unpublish / reject = take down; publish / approve = put live.
$unpublish = in_array($action, ['reject', 'unpublish', 'rejected'], true);
$publish = in_array($action, ['approve', 'publish', 'approved'], true);

if (!$unpublish && !$publish) {
    Response::error('Action must be publish or unpublish.', 422);
}

if ($unpublish) {
    if ($note === '') {
        Response::error('Please give the shop a reason so they can fix the listing.', 422);
    }
    try {
        $pdo->prepare(
            "UPDATE products SET listing_status = 'rejected', status = 'inactive', listing_admin_note = ? WHERE id = ?"
        )->execute([$note, $id]);
    } catch (\Throwable) {
        $pdo->prepare(
            "UPDATE products SET listing_status = 'rejected', status = 'inactive' WHERE id = ?"
        )->execute([$id]);
    }
    NotificationService::notifyProductListingDecision($pdo, $product, 'reject', $note);
    Response::success(['message' => 'Listing unpublished. The shop was notified with your reason.', 'id' => $id]);
}

try {
    $pdo->prepare(
        "UPDATE products SET listing_status = 'approved', status = 'active', listing_admin_note = NULL WHERE id = ?"
    )->execute([$id]);
} catch (\Throwable) {
    $pdo->prepare(
        "UPDATE products SET listing_status = 'approved', status = 'active' WHERE id = ?"
    )->execute([$id]);
}
NotificationService::notifyProductListingDecision($pdo, $product, 'approve', $note !== '' ? $note : null);
Response::success(['message' => 'Listing published and live on the shop storefront.', 'id' => $id]);
