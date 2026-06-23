<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosLocationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageConfig($user);

Response::success(['data' => PosLocationService::list($pdo)]);
