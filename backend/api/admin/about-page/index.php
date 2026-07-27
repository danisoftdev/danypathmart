<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AboutPageService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_about_page', 'view_about_page']);

Response::success(['page' => AboutPageService::getAdmin(Database::pdo())]);
