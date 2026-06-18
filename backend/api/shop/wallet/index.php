<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MarketplaceSplitService;
use App\Helpers\Response;
use App\Helpers\ShopWalletService;
use App\Helpers\SubscriptionReferralService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$wallet = ShopWalletService::getWallet($pdo, $ctx['shop_id']);
$transactions = ShopWalletService::listTransactions($pdo, $ctx['shop_id']);
$earnings = MarketplaceSplitService::earningsForShop($pdo, $ctx['shop_id']);

Response::success([
    'wallet'       => $wallet,
    'transactions' => $transactions,
    'earnings'     => $earnings,
    'shop'         => $ctx['shop'],
    'breakdown'    => SubscriptionReferralService::shopWalletBreakdown($pdo, $ctx['shop_id']),
]);
