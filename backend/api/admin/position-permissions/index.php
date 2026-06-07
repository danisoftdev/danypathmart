<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PositionPermissionService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAnyPermission(['manage_staff', 'manage_position_permissions']);

$pdo = Database::pdo();

Response::success(['data' => PositionPermissionService::listWithTemplates($pdo)]);
