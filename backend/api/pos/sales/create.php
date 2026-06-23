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
    $sale = PosSaleService::complete(
        $pdo,
        $shiftId,
        (int) $user['id'],
        is_array($body['items'] ?? null) ? $body['items'] : [],
        is_array($body['payments'] ?? null) ? $body['payments'] : [],
        isset($body['discount_amount']) ? (float) $body['discount_amount'] : 0.0,
        isset($body['customer_name']) ? (string) $body['customer_name'] : null,
        isset($body['customer_phone']) ? (string) $body['customer_phone'] : null,
        isset($body['customer_user_id']) ? (int) $body['customer_user_id'] : null,
        isset($body['supervisor_pin']) ? (string) $body['supervisor_pin'] : null,
    );
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 422);
}

$receipt = PosReceiptService::build($pdo, (int) $sale['id']);
$sms = null;
if (!empty($body['send_sms']) && !empty($sale['customer_phone'])) {
    $sms = PosReceiptService::sendSms($pdo, (int) $sale['id']);
}

Response::success([
    'sale'    => $sale,
    'receipt' => $receipt,
    'sms'     => $sms,
], 201);
