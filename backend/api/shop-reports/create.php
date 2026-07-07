<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopReportService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$orderId = (int) ($body['order_id'] ?? 0);
$reason = trim((string) ($body['reason'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));

if ($orderId <= 0) {
    Response::error('Order is required to file a report.', 422);
}

try {
    $report = ShopReportService::create($pdo, (int) $user['id'], $orderId, $reason, $description);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['report' => $report], 201);
