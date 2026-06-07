<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DeliveryRunService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$driver = AuthMiddleware::requireDriver();
$pdo = Database::pdo();

Response::success(['data' => DeliveryRunService::driverActiveRuns($pdo, (int) $driver['id'])]);
