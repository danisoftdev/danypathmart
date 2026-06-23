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
PosGate::assertUsePos($user);

$body = Response::body();
$registerId = (int) ($body['register_id'] ?? 0);
$float = isset($body['opening_float']) ? (float) $body['opening_float'] : 0.0;

if ($registerId <= 0) {
    Response::error('Register id is required.', 422);
}

try {
    $shift = PosShiftService::open($pdo, $registerId, (int) $user['id'], $float);
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['shift' => $shift], 201);
