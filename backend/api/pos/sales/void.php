<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosSaleService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);

$orderId = (int) ($_GET['id'] ?? 0);
$body = Response::body();
$reason = trim((string) ($body['reason'] ?? ''));
if ($reason === '') {
    Response::error('Void reason is required.', 422);
}

$asSupervisor = PosGate::canManageShifts($user);
if (!$asSupervisor && !PosGate::canUsePos($user)) {
    Response::error('Permission denied.', 403);
}

try {
    PosSaleService::void($pdo, $orderId, (int) $user['id'], $reason, $asSupervisor);
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Sale voided.']);
