<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Helpers\ShopReferralService;
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

$billingSettings = ShopBillingService::publicSettings($pdo);
$subscription = ShopBillingService::subscriptionForShop($pdo, $shopId);
$inGoodStanding = ShopBillingService::isShopInGoodStanding($pdo, $shopId);
$publiclyVisible = ShopBillingService::isShopPubliclyVisible($pdo, $shopId);
$daysUntilExpiry = ShopBillingService::daysUntilExpiry($pdo, $shopId);

$awaitingPay = $pdo->prepare(
    "SELECT COUNT(*) FROM shop_order_fulfillments WHERE shop_id = ? AND status = 'awaiting_payment'"
);
$awaitingPay->execute([$shopId]);

Response::success([
    'shop'             => $ctx['shop'],
    'product_count'    => $productCount,
    'pending_listings' => $pendingListings,
    'awaiting_payment_orders' => (int) $awaitingPay->fetchColumn(),
    'sharing'          => ShopReferralService::dashboardStats($pdo, $shopId),
    'billing'          => [
        'settings'           => $billingSettings,
        'subscription'       => $subscription,
        'in_good_standing'   => $inGoodStanding,
        'publicly_visible'   => $publiclyVisible,
        'days_until_expiry'  => $daysUntilExpiry,
        'renewal_due'        => $billingSettings['enabled']
            && $billingSettings['renewal_fee'] > 0
            && !$inGoodStanding,
        'renewal_soon'       => $daysUntilExpiry !== null && $daysUntilExpiry >= 0 && $daysUntilExpiry <= 7,
    ],
]);
