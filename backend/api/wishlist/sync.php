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
$localIds = $body['product_ids'] ?? [];
if (!is_array($localIds)) {
    $localIds = [];
}

$localIds = array_values(array_unique(array_filter(array_map('intval', $localIds), static fn ($id) => $id > 0)));
if ($localIds === []) {
    Response::success(['merged' => 0]);
}

$insert = $pdo->prepare(
    'INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)'
);
$merged = 0;
foreach ($localIds as $productId) {
    $check = $pdo->prepare('SELECT id FROM products WHERE id = ? AND status = \'active\'');
    $check->execute([$productId]);
    if ($check->fetch() === false) {
        continue;
    }
    $insert->execute([$userId, $productId]);
    $merged += (int) $insert->rowCount();
}

Response::success(['merged' => $merged]);
