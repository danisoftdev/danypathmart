<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosReportService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$shiftId = (int) ($_GET['shift_id'] ?? 0);
$type = (string) ($_GET['type'] ?? 'x');
if ($shiftId <= 0) {
    Response::error('shift_id is required.', 422);
}

try {
    $report = PosReportService::shiftReport($pdo, $shiftId, $type);
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success($report);
