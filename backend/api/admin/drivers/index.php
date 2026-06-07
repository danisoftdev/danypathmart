<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DriverAccountService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_delivery_runs', 'manage_staff', 'edit_company_settings']);

$pdo = Database::pdo();

Response::success(['data' => DriverAccountService::listDrivers($pdo)]);
