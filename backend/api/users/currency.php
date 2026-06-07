<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$pdo->prepare("UPDATE users SET preferred_currency = 'GHS' WHERE id = ?")
    ->execute([(int) $user['id']]);

Response::success(['message' => 'All prices are shown in Ghana Cedis (GHS).', 'preferred_currency' => 'GHS']);
