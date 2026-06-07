<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$items = $body['items'] ?? null;
if (!is_array($items) || $items === []) {
    Response::error('Add at least one item.', 422);
}

$quote = QuoteService::createRequest($pdo, (int) $user['id'], $body, $items);

Response::success(['quote' => $quote], 201);
