<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterWalletService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$ctx = AuthMiddleware::requirePromoter();
$pdo = Database::pdo();
$body = Response::body();

$amount = (float) ($body['amount'] ?? 0);
$method = trim((string) ($body['payout_method'] ?? 'bank'));
$details = [
    'bank_name'           => trim((string) ($body['bank_name'] ?? '')),
    'bank_account_name'   => trim((string) ($body['bank_account_name'] ?? '')),
    'bank_account_number' => trim((string) ($body['bank_account_number'] ?? '')),
    'momo_number'         => trim((string) ($body['momo_number'] ?? '')),
];

try {
    $w = PromoterWalletService::requestWithdrawal($pdo, $ctx['promoter_id'], (int) $ctx['user']['id'], $amount, $method, $details);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not request withdrawal.', 500);
}

Response::success(['message' => 'Withdrawal requested.', 'withdrawal' => $w], 201);
