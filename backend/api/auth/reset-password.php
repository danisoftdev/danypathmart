<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PasswordResetService;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\RateLimiter;

$body = Response::body();
$token      = trim((string) ($body['token'] ?? ''));
$identifier = trim((string) ($body['identifier'] ?? ''));
$otp        = trim((string) ($body['otp'] ?? $body['code'] ?? ''));
$password   = (string) ($body['new_password'] ?? '');
$confirm    = (string) ($body['confirm_password'] ?? '');

$limit = RateLimiter::hit('reset:ip:' . RateLimiter::clientIp(), 20, 900);
if (!$limit['allowed']) {
    Response::error('Too many attempts. Please try again later.', 429, [
        'retry_after' => $limit['retry_after'],
        'code'        => 'rate_limited',
    ]);
}

if (!Validator::passwordStrong($password)) {
    Response::error('Password must be at least 8 characters and include an uppercase letter and a number', 422);
}
if (!hash_equals($password, $confirm)) {
    Response::error('Passwords do not match', 422);
}

$usingToken = $token !== '';
$usingCode  = $identifier !== '' && $otp !== '';

if (!$usingToken && !$usingCode) {
    Response::error('Provide a valid reset link or your email/username plus the 6-digit code.', 400, [
        'code' => 'bad_token',
    ]);
}

$pdo = Database::pdo();

try {
    $result = PasswordResetService::complete(
        $pdo,
        $password,
        $usingToken ? $token : null,
        $usingCode ? $identifier : null,
        $usingCode ? $otp : null
    );
} catch (\Throwable $e) {
    error_log('Password reset complete failed: ' . $e->getMessage());
    Response::error('Could not reset password. Please try again.', 500);
}

if (!($result['ok'] ?? false)) {
    $err = (string) ($result['error'] ?? 'bad_token');
    $message = match ($err) {
        'locked'  => 'Too many incorrect codes. Request a new reset email.',
        'expired' => 'This reset code or link has expired. Request a new one.',
        'invalid' => 'Invalid reset code. Check the code and try again.',
        default   => 'This reset link or code is invalid or has expired.',
    };
    Response::error($message, 400, ['code' => $err === 'invalid' ? 'bad_otp' : 'bad_token']);
}

Response::success(['message' => 'Password changed. Please log in.']);
