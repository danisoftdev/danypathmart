<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosLocationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageConfig($user);

try {
    $loc = PosLocationService::create($pdo, Response::body());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['location' => $loc], 201);
