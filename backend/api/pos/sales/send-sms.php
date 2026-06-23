<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosReceiptService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$orderId = (int) ($_GET['id'] ?? 0);
$body = Response::body();
$phone = isset($body['phone']) ? (string) $body['phone'] : null;

$result = PosReceiptService::sendSms($pdo, $orderId, $phone);
if (!$result['ok']) {
    Response::error($result['error'] ?? 'SMS failed.', 422);
}

Response::success(['message' => 'Receipt SMS sent.']);
