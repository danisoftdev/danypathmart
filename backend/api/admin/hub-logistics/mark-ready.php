<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\HubLogisticsService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_hub_logistics', 'edit_company_settings']);

$pdo = Database::pdo();
$body = Response::body();
$orderIds = is_array($body['order_ids'] ?? null) ? $body['order_ids'] : [];
$note = isset($body['note']) ? trim((string) $body['note']) : null;

try {
    $updated = HubLogisticsService::markReadyForPickup($pdo, $orderIds, (int) $admin['id'], $note !== '' ? $note : null);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'        => count($updated) > 0 ? 'Orders marked ready for pickup.' : 'No orders were updated.',
    'updated'        => $updated,
    'updated_count'  => count($updated),
]);
