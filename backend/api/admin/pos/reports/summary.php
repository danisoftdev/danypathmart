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

if (!PosGate::canManageShifts($user) && !PosGate::canManageConfig($user)) {
    $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
    if (empty($perms['view_pos_reports']) && ($user['role'] ?? '') !== 'super_admin') {
        Response::error('Permission denied.', 403);
    }
}

$from = isset($_GET['from']) ? (string) $_GET['from'] : null;
$to = isset($_GET['to']) ? (string) $_GET['to'] : null;

Response::success(['data' => PosReportService::summary($pdo, $from, $to)]);
