<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosRegisterService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageConfig($user);

$locationId = isset($_GET['location_id']) ? (int) $_GET['location_id'] : 0;
Response::success([
    'data' => PosRegisterService::list($pdo, $locationId > 0 ? $locationId : null),
]);
