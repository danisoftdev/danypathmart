<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StationAccountService;
use App\Helpers\StationRepackService;
use App\Middleware\AuthMiddleware;

$staff = AuthMiddleware::requireStationStaff();
$pdo = Database::pdo();
$queue = (string) ($_GET['queue'] ?? 'inbound');

try {
    $stationId = StationAccountService::resolveStationIdForUser($staff);
    $data = match ($queue) {
        'ready' => StationRepackService::readyForCollectionQueue($pdo, $stationId),
        default => StationRepackService::inboundQueue($pdo, $stationId),
    };
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['queue' => $queue, 'data' => $data]);
