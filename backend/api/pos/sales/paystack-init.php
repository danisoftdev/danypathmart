<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosReceiptService;
use App\Helpers\PosSaleService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$body = Response::body();
$shiftId = (int) ($body['shift_id'] ?? 0);
if ($shiftId <= 0) {
    Response::error('Shift id is required.', 422);
}

try {
    $init = PosSaleService::initPaystack(
        $pdo,
        $shiftId,
        (int) $user['id'],
        is_array($body['items'] ?? null) ? $body['items'] : [],
        isset($body['discount_amount']) ? (float) $body['discount_amount'] : 0.0,
        isset($body['customer_name']) ? (string) $body['customer_name'] : null,
        isset($body['customer_phone']) ? (string) $body['customer_phone'] : null,
        isset($body['customer_email']) ? (string) $body['customer_email'] : ($user['email'] ?? null),
        isset($body['supervisor_pin']) ? (string) $body['supervisor_pin'] : null,
    );
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success($init, 201);
