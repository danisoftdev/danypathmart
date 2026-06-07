<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$pdo = Database::pdo();
Response::success([
    'data'          => NotificationService::listForUser($pdo, (int) $user['id']),
    'unread_count'  => NotificationService::unreadCount($pdo, (int) $user['id']),
]);
