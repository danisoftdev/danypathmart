<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PickupStationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_pickup_stations', 'edit_company_settings']);

$pdo = Database::pdo();

Response::success(['data' => PickupStationService::listAll($pdo)]);
