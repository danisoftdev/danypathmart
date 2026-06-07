<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DeliveryRunService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_delivery_runs', 'edit_company_settings']);

$pdo = Database::pdo();
$body = Response::body();

try {
    $run = DeliveryRunService::createRun($pdo, [
        'driver_user_id' => (int) ($body['driver_user_id'] ?? 0),
        'order_ids'      => is_array($body['order_ids'] ?? null) ? $body['order_ids'] : [],
        'title'          => $body['title'] ?? null,
        'hub_note'       => $body['hub_note'] ?? null,
    ], (int) $admin['id']);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Delivery run created.', 'run' => $run], 201);
