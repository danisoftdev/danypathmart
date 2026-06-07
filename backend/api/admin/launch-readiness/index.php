<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LaunchReadinessService;
use App\Helpers\ModuleRolloutService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['view_company_settings', 'edit_company_settings']);

$pdo = Database::pdo();
$result = LaunchReadinessService::evaluate($pdo);
$result['module_rollout'] = ModuleRolloutService::status($pdo);

Response::success($result);
