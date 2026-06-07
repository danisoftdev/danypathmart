<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\KitBuilderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_products');

$pdo = Database::pdo();

Response::success(['data' => KitBuilderService::listAll($pdo, false)]);
