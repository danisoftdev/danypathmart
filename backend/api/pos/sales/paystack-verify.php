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
$orderId = (int) ($body['order_id'] ?? 0);
$reference = trim((string) ($body['reference'] ?? ''));
if ($orderId <= 0 || $reference === '') {
    Response::error('order_id and reference are required.', 422);
}

try {
    $sale = PosSaleService::completePaystack($pdo, $orderId, $reference, (int) $user['id']);
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
]);
