<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\HubLogisticsService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_hub_logistics', 'edit_company_settings']);

$pdo = Database::pdo();
$queue = (string) ($_GET['queue'] ?? 'receive');
$stationId = isset($_GET['station_id']) ? (int) $_GET['station_id'] : null;

try {
    $data = match ($queue) {
        'ready'   => HubLogisticsService::hubReadyForRunQueue($pdo),
        'station' => HubLogisticsService::stationReceiveQueue($pdo, $stationId > 0 ? $stationId : null),
        default   => HubLogisticsService::hubReceiveQueue($pdo),
    };
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['queue' => $queue, 'data' => $data]);
