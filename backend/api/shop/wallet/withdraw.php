<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopWalletService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$body = Response::body();

$amount = isset($body['amount']) ? (float) $body['amount'] : 0;
$method = trim((string) ($body['payout_method'] ?? 'bank'));
if (!in_array($method, ['bank', 'momo'], true)) {
    Response::error('Invalid payout method.', 422);
}

$details = [
    'bank_name'           => trim((string) ($body['bank_name'] ?? $ctx['shop']['bank_name'] ?? '')),
    'bank_account_name'   => trim((string) ($body['bank_account_name'] ?? $ctx['shop']['bank_account_name'] ?? '')),
    'bank_account_number' => trim((string) ($body['bank_account_number'] ?? $ctx['shop']['bank_account_number'] ?? '')),
    'momo_number'         => trim((string) ($body['momo_number'] ?? $ctx['shop']['momo_number'] ?? '')),
];

try {
    $w = ShopWalletService::requestWithdrawal($pdo, $ctx['shop_id'], (int) $ctx['user']['id'], $amount, $method, $details);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Withdrawal requested.', 'withdrawal' => $w], 201);
