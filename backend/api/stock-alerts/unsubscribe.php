<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\RestockAlertService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$productId = (int) ($body['product_id'] ?? $_GET['product_id'] ?? 0);
if ($productId <= 0) {
    Response::error('Product is required.', 422);
}

$clubTag = isset($body['club_tag']) ? (string) $body['club_tag'] : null;
RestockAlertService::unsubscribe($pdo, (int) $user['id'], $productId, $clubTag);

Response::success(['message' => 'Restock alert removed.']);
