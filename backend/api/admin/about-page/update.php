<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AboutPageService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_about_page');

try {
    $page = AboutPageService::update(Database::pdo(), Response::body());
    Response::success(['message' => 'About page saved.', 'page' => $page]);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}
