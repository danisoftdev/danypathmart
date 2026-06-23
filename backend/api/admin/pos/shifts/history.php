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

if (!PosGate::canManageShifts($user) && !PosGate::canManageConfig($user)) {
    $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
    if (empty($perms['view_pos_reports']) && ($user['role'] ?? '') !== 'super_admin') {
        Response::error('Permission denied.', 403);
    }
}

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;

Response::success(['data' => PosShiftService::listHistory($pdo, $limit)]);
