<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosSettingsService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertManageConfig($user);

try {
    $settings = PosSettingsService::update($pdo, Response::body());
} catch (\RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['settings' => $settings]);
