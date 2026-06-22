<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Helpers\SubscriptionReferralService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();

$email = strtolower(trim((string) ($_GET['email'] ?? '')));
$referralCode = trim((string) ($_GET['referral_code'] ?? ''));

$hasReferrer = false;
if ($referralCode !== '') {
    $resolved = SubscriptionReferralService::resolveReferrer($pdo, $referralCode);
    $hasReferrer = $resolved !== null;
}

$quote = ShopBillingService::computeRegistrationPricing($pdo, [
    'user_id'          => $user !== null ? (int) $user['id'] : null,
    'email'            => $email !== '' ? $email : ($user['email'] ?? null),
    'has_valid_referrer' => $hasReferrer,
]);

Response::success(['quote' => $quote]);
