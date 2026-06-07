<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PickupStationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_pickup_stations', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Pickup station not found.', 404);
}

$pdo = Database::pdo();

try {
    PickupStationService::delete($pdo, $id);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not delete pickup station.', 500);
}

Response::success(['message' => 'Pickup station deleted.', 'id' => $id]);
