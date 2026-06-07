<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DeliveryRunService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_delivery_runs', 'edit_company_settings']);

$pdo = Database::pdo();
$status = isset($_GET['status']) ? (string) $_GET['status'] : null;

try {
    $runs = DeliveryRunService::listRuns($pdo, $status);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['data' => $runs]);
