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

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Location id is required.', 422);
}

try {
    $location = PosLocationService::update($pdo, $id, Response::body());
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['data' => $location]);
