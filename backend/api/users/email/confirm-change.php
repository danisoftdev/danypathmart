<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\AvailabilityService;
use App\Helpers\OTPService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$otp = trim((string) ($body['otp'] ?? ''));
if (!preg_match('/^\d{6}$/', $otp)) {
    Response::error('Enter the 6-digit code from your email.', 422);
}

$stmt = $pdo->prepare(
    'SELECT id, new_email, otp_hash, expires_at, attempts FROM email_change_requests
     WHERE user_id = ? ORDER BY id DESC LIMIT 1'
);
$stmt->execute([(int) $user['id']]);
$req = $stmt->fetch();

if ($req === false) {
    Response::error('No pending email change found. Start again.', 404, ['code' => 'none']);
}
if ((int) $req['attempts'] >= OTPService::MAX_ATTEMPTS) {
    Response::error('Too many incorrect attempts. Start again.', 429, ['code' => 'locked']);
}
if (strtotime((string) $req['expires_at']) < time()) {
    Response::error('This code has expired. Start again.', 410, ['code' => 'expired']);
}

if (!hash_equals((string) $req['otp_hash'], OTPService::hash($otp))) {
    $pdo->prepare('UPDATE email_change_requests SET attempts = attempts + 1 WHERE id = ?')
        ->execute([(int) $req['id']]);
    Response::error('Incorrect code. Try again.', 401, ['code' => 'invalid']);
}

$newEmail = strtolower((string) $req['new_email']);

// Re-check availability at confirm time (race safety).
$emailCheck = AvailabilityService::check($pdo, 'email', $newEmail, (int) $user['id']);
if (!$emailCheck['available']) {
    $pdo->prepare('DELETE FROM email_change_requests WHERE user_id = ?')->execute([(int) $user['id']]);
    Response::error($emailCheck['message'], 409, ['code' => 'email_taken']);
}

$pdo->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$newEmail, (int) $user['id']]);
$pdo->prepare('DELETE FROM email_change_requests WHERE user_id = ?')->execute([(int) $user['id']]);

$fresh = $pdo->prepare(
    'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
     FROM users WHERE id = ?'
);
$fresh->execute([(int) $user['id']]);

Response::success([
    'message' => 'Your email address has been updated.',
    'user'    => AuthTokens::publicUser($fresh->fetch()),
]);
