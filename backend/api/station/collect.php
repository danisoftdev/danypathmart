<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StationAccountService;
use App\Helpers\StationRepackService;
use App\Middleware\AuthMiddleware;

$staff = AuthMiddleware::requireStationStaff();
$pdo = Database::pdo();
$body = Response::body();
$orderIds = is_array($body['order_ids'] ?? null) ? $body['order_ids'] : [];

try {
    $stationId = StationAccountService::resolveStationIdForUser($staff);
    $updated = StationRepackService::markCollected(
        $pdo,
        $orderIds,
        $stationId,
        (int) $staff['id'],
        isset($body['note']) ? trim((string) $body['note']) : null
    );
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'        => count($updated) > 0 ? 'Orders marked collected.' : 'No orders were updated.',
    'updated'        => $updated,
    'updated_count'  => count($updated),
]);
