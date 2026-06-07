<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\HeroBannerService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_hero_banners');

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Banner not found.', 404);
}

try {
    $banner = HeroBannerService::update(Database::pdo(), $id, Response::body());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Hero banner updated.', 'banner' => $banner]);
