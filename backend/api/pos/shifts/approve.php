<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosReportService;
use App\Helpers\PosShiftService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageShifts($user);

$body = Response::body();
$shiftId = (int) ($body['shift_id'] ?? $_GET['id'] ?? 0);
if ($shiftId <= 0) {
    Response::error('Shift id is required.', 422);
}

try {
    $shift = PosShiftService::approve($pdo, $shiftId, (int) $user['id']);
    $zReport = PosReportService::shiftReport($pdo, $shiftId, 'z');
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['shift' => $shift, 'z_report' => $zReport]);
