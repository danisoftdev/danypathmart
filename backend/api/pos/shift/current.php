<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosSaleService;
use App\Helpers\PosShiftService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$registerId = isset($_GET['register_id']) ? (int) $_GET['register_id'] : 0;
if ($registerId <= 0) {
    Response::error('register_id is required.', 422);
}

$shift = PosShiftService::currentForRegister($pdo, $registerId);
$sales = $shift !== null ? PosSaleService::listForShift($pdo, (int) $shift['id']) : [];

Response::success(['shift' => $shift, 'sales' => $sales]);
