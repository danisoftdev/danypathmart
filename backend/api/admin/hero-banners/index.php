<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\HeroBannerService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_hero_banners', 'view_hero_banners']);

Response::success(['data' => HeroBannerService::listAll(Database::pdo())]);
