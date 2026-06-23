<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportBotService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_support_bot');

try {
    $node = SupportBotService::upsertNode(Database::pdo(), Response::body());
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['node' => $node]);
