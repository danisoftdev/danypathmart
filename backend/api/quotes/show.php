<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Quote not found.', 404);
}

$quote = QuoteService::getById($pdo, $id, (int) $user['id']);
if ($quote === null) {
    Response::error('Quote not found.', 404);
}

Response::success(['quote' => $quote]);
