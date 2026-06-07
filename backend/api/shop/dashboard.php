<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MarketplaceSplitService;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Helpers\ShopReferralService;
use App\Helpers\ShopWalletService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$shopId = $ctx['shop_id'];

$pcStmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE shop_id = ?');
$pcStmt->execute([$shopId]);
$productCount = (int) $pcStmt->fetchColumn();

$plStmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE shop_id = ? AND listing_status = 'pending'");
$plStmt->execute([$shopId]);
$pendingListings = (int) $plStmt->fetchColumn();

$wallet = ShopWalletService::getWallet($pdo, $shopId);
$earnings = MarketplaceSplitService::earningsForShop($pdo, $shopId, 5);
$billingSettings = ShopBillingService::publicSettings($pdo);
$subscription = ShopBillingService::subscriptionForShop($pdo, $shopId);
$inGoodStanding = ShopBillingService::isShopInGoodStanding($pdo, $shopId);

Response::success([
    'shop'             => $ctx['shop'],
    'wallet'           => $wallet,
    'product_count'    => $productCount,
    'pending_listings' => $pendingListings,
    'recent_earnings'  => $earnings,
    'sharing'          => ShopReferralService::dashboardStats($pdo, $shopId),
    'billing'          => [
        'settings'         => $billingSettings,
        'subscription'     => $subscription,
        'in_good_standing' => $inGoodStanding,
        'renewal_due'      => $billingSettings['enabled']
            && $billingSettings['renewal_fee'] > 0
            && !$inGoodStanding,
    ],
]);
