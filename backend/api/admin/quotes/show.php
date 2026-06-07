<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Quote not found.', 404);
}

$quote = QuoteService::getForAdmin($pdo, $id);
if ($quote === null) {
    Response::error('Quote not found.', 404);
}

$userStmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
$userStmt->execute([(int) $quote['user_id']]);
$owner = $userStmt->fetch();

Response::success([
    'quote' => $quote,
    'user'  => $owner !== false ? [
        'name'  => $owner['name'],
        'email' => $owner['email'],
    ] : null,
]);
