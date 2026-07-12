<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AccountDeletionService;
use App\Helpers\AuthTokens;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$body = Response::body();
$email    = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    Response::error('Email and password are required', 422);
}

// Rate limit: 5 attempts per IP per 10 minutes.
$limit = RateLimiter::hit('login:' . RateLimiter::clientIp(), 5, 600);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many login attempts. Try again later.', 429, [
        'retry_after' => $limit['retry_after'],
    ]);
}

$pdo = Database::pdo();
try {
    $stmt = $pdo->prepare(
        'SELECT id, name, username, email, password_hash, role, status, preferred_currency, totp_enabled,
                deletion_requested_at
         FROM users WHERE email = ?'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
} catch (\Throwable) {
    $stmt = $pdo->prepare(
        'SELECT id, name, username, email, password_hash, role, status, preferred_currency, totp_enabled
         FROM users WHERE email = ?'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
}

// Uniform failure message to avoid user enumeration.
if ($user === false || empty($user['password_hash']) || !password_verify($password, (string) $user['password_hash'])) {
    Response::error('Invalid email or password', 401);
}

if ($user['status'] === 'disabled') {
    Response::error('This account has been disabled.', 403);
}

$deletionGate = AccountDeletionService::gateLogin($pdo, $user);

if ($user['status'] === 'unverified') {
    Response::error('Please verify your email before logging in.', 403, [
        'code'    => 'email_unverified',
        'user_id' => (int) $user['id'],
    ]);
}

// Two-factor enabled: issue a short-lived temp token, no JWT yet.
if ((int) $user['totp_enabled'] === 1) {
    $tempToken = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 300); // 5 minutes
    $pdo->prepare(
        'INSERT INTO totp_temp_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    )->execute([(int) $user['id'], hash('sha256', $tempToken), $expires]);

    Response::success([
        'requires_2fa' => true,
        'temp_token'   => $tempToken,
        'message'      => 'Enter the 6-digit code from your authenticator app.',
    ]);
}

$tokens = AuthTokens::issueFor($user);

if (($user['role'] ?? '') === 'customer') {
    NotificationService::notifyAdmins(
        $pdo,
        'Customer sign-in — ' . (string) $user['name'],
        (string) $user['email'] . ' signed in.'
        . "\nIP: " . (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        '/admin/users',
        'admin_auth'
    );
}

$payload = ['message' => 'Logged in successfully.'] + $tokens;
if (!empty($deletionGate['restored'])) {
    $payload['message'] = 'Welcome back — your account deletion was cancelled and your account is active again.';
    $payload['account_restored'] = true;
}
Response::success($payload);
