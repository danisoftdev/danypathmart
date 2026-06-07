<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\HeroBannerService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_hero_banners');

try {
    $banner = HeroBannerService::create(Database::pdo(), Response::body());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Hero banner created.', 'banner' => $banner], 201);
