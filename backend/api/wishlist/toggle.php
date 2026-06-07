<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
if (($user['role'] ?? '') !== 'customer') {
    Response::error('Wishlist is for customer accounts.', 403);
}

$pdo = Database::pdo();
$userId = (int) $user['id'];
$body = Response::body();
$productId = (int) ($body['product_id'] ?? 0);

if ($productId <= 0) {
    Response::error('Product is required.', 422);
}

$check = $pdo->prepare('SELECT id FROM products WHERE id = ? AND status = \'active\'');
$check->execute([$productId]);
if ($check->fetch() === false) {
    Response::error('Product not found.', 404);
}

$exists = $pdo->prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ?');
$exists->execute([$userId, $productId]);
$onWishlist = $exists->fetch() !== false;

if ($onWishlist) {
    $pdo->prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
        ->execute([$userId, $productId]);
    $onWishlist = false;
} else {
    $pdo->prepare('INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)')
        ->execute([$userId, $productId]);
    $onWishlist = true;
}

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM wishlists WHERE user_id = ?');
$countStmt->execute([$userId]);

Response::success([
    'wishlisted' => $onWishlist,
    'count'      => (int) $countStmt->fetchColumn(),
]);
