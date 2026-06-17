<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LaunchReadinessService;
use App\Helpers\ModuleRolloutService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAdmin();
AuthMiddleware::requireSuperAdmin();

$pdo = Database::pdo();
$result = LaunchReadinessService::evaluate($pdo);
$result['module_rollout'] = ModuleRolloutService::status($pdo, $result);

Response::success($result);
