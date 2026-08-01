<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\OTPService;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$password = (string) ($body['password'] ?? '');
$confirm = (string) ($body['confirm_password'] ?? $body['password_confirmation'] ?? '');
$otp = trim((string) ($body['otp_code'] ?? $body['totp_code'] ?? ''));

if (!Validator::passwordStrong($password)) {
    Response::error('Password must be at least 8 characters and include an uppercase letter and a number.', 422);
}
if (!hash_equals($password, $confirm)) {
    Response::error('Passwords do not match.', 422);
}

$stmt = $pdo->prepare('SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo, must_change_password FROM users WHERE id = ?');
try {
    $stmt->execute([(int) $user['id']]);
    $row = $stmt->fetch();
} catch (\Throwable) {
    $stmt = $pdo->prepare('SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo FROM users WHERE id = ?');
    $stmt->execute([(int) $user['id']]);
    $row = $stmt->fetch();
    if (is_array($row)) {
        $row['must_change_password'] = 0;
    }
}

if ($row === false) {
    Response::error('User not found.', 404);
}

$mustChange = (int) ($row['must_change_password'] ?? 0) === 1;
$status = (string) ($row['status'] ?? '');

if (!$mustChange && $status !== 'unverified') {
    Response::error('Password setup is not required for this account.', 403, ['code' => 'setup_not_required']);
}

if ($status === 'unverified') {
    if ($otp === '') {
        Response::error('Enter the 6-digit verification code from your email.', 422, ['code' => 'otp_required']);
    }
    $otpResult = OTPService::verify((int) $row['id'], $otp, 'registration');
    if ($otpResult !== 'ok') {
        $msg = match ($otpResult) {
            'expired' => 'Verification code expired. Request a new one.',
            'locked'  => 'Too many incorrect codes. Request a new one.',
            'none'    => 'No verification code found. Request a new one.',
            default   => 'Incorrect verification code.',
        };
        Response::error($msg, 401, ['code' => 'otp_invalid']);
    }
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
try {
    $pdo->prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 0, status = 'verified' WHERE id = ?"
    )->execute([$hash, (int) $row['id']]);
} catch (\Throwable) {
    $pdo->prepare(
        "UPDATE users SET password_hash = ?, status = 'verified' WHERE id = ?"
    )->execute([$hash, (int) $row['id']]);
}

$freshStmt = $pdo->prepare(
    'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
     FROM users WHERE id = ?'
);
$freshStmt->execute([(int) $row['id']]);
$fresh = $freshStmt->fetch();

Response::success([
    'message' => 'Password saved and account verified.',
    'user'    => AuthTokens::publicUser($fresh ?: $row),
]);
