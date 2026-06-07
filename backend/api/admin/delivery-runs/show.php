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
$runId = (int) ($_GET['id'] ?? 0);
if ($runId <= 0) {
    Response::error('Delivery run not found.', 404);
}

$run = DeliveryRunService::findRun($pdo, $runId);
if ($run === null) {
    Response::error('Delivery run not found.', 404);
}

Response::success(['run' => $run]);
