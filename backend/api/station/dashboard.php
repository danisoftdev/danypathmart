<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StationAccountService;
use App\Helpers\StationRepackService;
use App\Middleware\AuthMiddleware;

$staff = AuthMiddleware::requireStationStaff();
$pdo = Database::pdo();

try {
    $stationId = StationAccountService::resolveStationIdForUser($staff);
    $summary = StationRepackService::stationSummary($pdo, $stationId);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success($summary);
