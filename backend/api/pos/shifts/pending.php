<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosShiftService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageShifts($user);

Response::success(['data' => PosShiftService::listPending($pdo)]);
