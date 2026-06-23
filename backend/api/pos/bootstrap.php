<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosLocationService;
use App\Helpers\PosRegisterService;
use App\Helpers\PosSettingsService;
use App\Helpers\PosShiftService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$registerId = isset($_GET['register_id']) ? (int) $_GET['register_id'] : 0;
$currentShift = $registerId > 0 ? PosShiftService::currentForRegister($pdo, $registerId) : null;

Response::success([
    'settings'   => PosSettingsService::load($pdo),
    'locations'  => PosLocationService::list($pdo, true),
    'registers'  => PosRegisterService::list($pdo, null, true),
    'shift'      => $currentShift,
    'user'       => [
        'id'   => (int) $user['id'],
        'name' => $user['name'] ?? '',
    ],
    'permissions'=> [
        'manage_shifts' => PosGate::canManageShifts($user),
        'manage_config' => PosGate::canManageConfig($user),
    ],
]);
