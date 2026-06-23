<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PushNotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$body = Response::body();
$sub = $body['subscription'] ?? $body;

try {
    PushNotificationService::subscribe(Database::pdo(), (int) $user['id'], is_array($sub) ? $sub : []);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Push subscription saved.']);
