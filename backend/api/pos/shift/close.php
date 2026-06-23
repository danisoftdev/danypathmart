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
PosGate::assertUsePos($user);

$body = Response::body();
$shiftId = (int) ($body['shift_id'] ?? 0);
$counted = isset($body['counted_cash']) ? (float) $body['counted_cash'] : 0.0;
$note = isset($body['variance_note']) ? (string) $body['variance_note'] : null;

if ($shiftId <= 0) {
    Response::error('Shift id is required.', 422);
}

try {
    $shift = PosShiftService::close($pdo, $shiftId, (int) $user['id'], $counted, $note);
    $zReport = PosReportService::shiftReport($pdo, $shiftId, 'z');
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['shift' => $shift, 'z_report' => $zReport]);
