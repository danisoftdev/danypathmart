<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\RestockAlertService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
if (($user['role'] ?? '') !== 'customer') {
    Response::error('Only customer accounts can subscribe to restock alerts.', 403);
}

$pdo = Database::pdo();
$body = Response::body();

$productId = (int) ($body['product_id'] ?? 0);
if ($productId <= 0) {
    Response::error('Product is required.', 422);
}

$chk = $pdo->prepare('SELECT id FROM products WHERE id = ? AND status = ?');
$chk->execute([$productId, 'active']);
if ($chk->fetchColumn() === false) {
    Response::error('Product not found.', 404);
}

$clubTag = isset($body['club_tag']) ? (string) $body['club_tag'] : null;
RestockAlertService::subscribe($pdo, (int) $user['id'], $productId, $clubTag);

Response::success(['message' => 'We will notify you when this item is back in stock.']);
