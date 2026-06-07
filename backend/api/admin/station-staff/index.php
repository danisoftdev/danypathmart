<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StationAccountService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_station_staff', 'edit_company_settings']);

$pdo = Database::pdo();
$stationId = isset($_GET['station_id']) ? (int) $_GET['station_id'] : null;

Response::success(['data' => StationAccountService::listStationStaff($pdo, $stationId > 0 ? $stationId : null)]);
