<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ReferralService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$code = ReferralService::ensureCode($pdo, (int) $user['id']);
$settings = ReferralService::settings($pdo);

$countStmt = $pdo->prepare(
    'SELECT COUNT(*) FROM referral_credits WHERE referrer_user_id = ?'
);
$referrals = 0;
try {
    $countStmt->execute([(int) $user['id']]);
    $referrals = (int) $countStmt->fetchColumn();
} catch (\Throwable) {
    $referrals = 0;
}

Response::success([
    'code'          => $code,
    'enabled'       => $settings['enabled'],
    'credit_amount' => $settings['amount'],
    'referrals'     => $referrals,
]);
