<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AvailabilityService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimiter;

$limit = RateLimiter::hit('availability:' . RateLimiter::clientIp(), 60, 60);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many checks. Try again shortly.', 429, [
        'retry_after' => $limit['retry_after'],
    ]);
}

$type = strtolower(trim((string) ($_GET['type'] ?? '')));
$value = trim((string) ($_GET['value'] ?? ''));
$excludeUserId = isset($_GET['exclude_user_id']) ? (int) $_GET['exclude_user_id'] : 0;
$excludeShopId = isset($_GET['exclude_shop_id']) ? (int) $_GET['exclude_shop_id'] : 0;

$auth = AuthMiddleware::optional();
if ($auth !== null && $excludeUserId <= 0) {
    $excludeUserId = (int) $auth['id'];
}

$result = AvailabilityService::check(
    Database::pdo(),
    $type,
    $value,
    $excludeUserId > 0 ? $excludeUserId : null,
    $excludeShopId > 0 ? $excludeShopId : null
);

Response::success($result);
