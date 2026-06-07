<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\NotificationService;
use App\Helpers\OTPService;
use App\Helpers\Response;

$body = Response::body();
$userId = (int) ($body['user_id'] ?? 0);
$otp    = trim((string) ($body['otp'] ?? ''));

if ($userId <= 0 || $otp === '') {
    Response::error('user_id and otp are required', 422);
}
if (!preg_match('/^\d{6}$/', $otp)) {
    Response::error('OTP must be a 6-digit code', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT id, name, username, email, role, status, preferred_currency, totp_enabled FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if ($user === false) {
    Response::error('Account not found', 404);
}
if ($user['status'] === 'verified') {
    Response::error('This account is already verified. Please log in.', 409);
}

$result = OTPService::verify($userId, $otp, 'registration');

switch ($result) {
    case 'ok':
        break;
    case 'expired':
        Response::error('This code has expired. Request a new one.', 410, ['code' => 'otp_expired']);
    case 'locked':
        Response::error('Too many incorrect attempts. Request a new code.', 429, ['code' => 'otp_locked']);
    case 'none':
        Response::error('No active code found. Request a new one.', 404, ['code' => 'otp_none']);
    case 'invalid':
    default:
        Response::error('Incorrect verification code', 401, ['code' => 'otp_invalid']);
}

$pdo->prepare("UPDATE users SET status = 'verified' WHERE id = ?")->execute([$userId]);
$user['status'] = 'verified';

$tokens = AuthTokens::issueFor($user);

NotificationService::notifyAdmins(
    $pdo,
    'Customer verified — ' . (string) $user['name'],
    (string) $user['email'] . ' verified their email and can shop.',
    '/admin/users',
    'admin_auth'
);

Response::success([
    'message' => 'Email verified successfully.',
] + $tokens);
