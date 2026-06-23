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

$body = Response::body();
$shiftId = (int) ($body['shift_id'] ?? $_GET['id'] ?? 0);
$note = trim((string) ($body['note'] ?? ''));
if ($shiftId <= 0 || $note === '') {
    Response::error('Shift id and rejection note are required.', 422);
}

try {
    $shift = PosShiftService::reject($pdo, $shiftId, (int) $user['id'], $note);
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['shift' => $shift]);
