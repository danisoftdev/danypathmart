<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Notification not found.', 404);
}

$pdo = Database::pdo();
if (!NotificationService::deleteOneForUser($pdo, (int) $user['id'], $id)) {
    Response::error('Notification not found.', 404);
}

Response::success(['message' => 'Notification deleted.']);
