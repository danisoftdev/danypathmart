<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Quote not found.', 404);
}

$result = QuoteService::convertToOrder($pdo, $id, (int) $user['id'], $body);

Response::success($result, 201);
