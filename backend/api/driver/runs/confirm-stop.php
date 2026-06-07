<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DeliveryRunService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$driver = AuthMiddleware::requireDriver();
$pdo = Database::pdo();
$body = Response::body();

$runId = (int) ($_GET['run_id'] ?? 0);
$orderId = (int) ($body['order_id'] ?? 0);
$note = isset($body['note']) ? trim((string) $body['note']) : null;

if ($runId <= 0 || $orderId <= 0) {
    Response::error('Run and order are required.', 422);
}

try {
    $run = DeliveryRunService::confirmStopDelivery(
        $pdo,
        $runId,
        $orderId,
        (int) $driver['id'],
        $note !== '' ? $note : null
    );
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Drop confirmed at station.', 'run' => $run]);
