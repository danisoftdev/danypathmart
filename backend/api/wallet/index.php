<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\WalletService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
if (($user['role'] ?? '') !== 'customer') {
    Response::error('Wallet is available for customer accounts.', 403);
}

$pdo = Database::pdo();
$userId = (int) $user['id'];

Response::success([
    'balance'      => WalletService::getBalance($pdo, $userId),
    'currency'     => 'GHS',
    'transactions' => WalletService::listTransactions($pdo, $userId),
]);
