<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AccountDeletionService;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Helpers\TOTPService;
use App\Middleware\RateLimiter;

$body = Response::body();
$token = (string) ($body['temp_token'] ?? $body['token'] ?? '');
$code  = trim((string) ($body['totp_code'] ?? ''));

if ($token === '' || $code === '') {
    Response::error('temp_token and totp_code are required', 422);
}

$pdo = Database::pdo();
try {
    $stmt = $pdo->prepare(
        'SELECT t.id AS temp_id, u.id, u.name, u.username, u.email, u.role, u.status,
                u.preferred_currency, u.totp_enabled, u.totp_secret, u.deletion_requested_at
         FROM totp_temp_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch();
} catch (\Throwable) {
    $stmt = $pdo->prepare(
        'SELECT t.id AS temp_id, u.id, u.name, u.username, u.email, u.role, u.status,
                u.preferred_currency, u.totp_enabled, u.totp_secret
         FROM totp_temp_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > NOW()'
    );
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch();
}

if ($row === false) {
    Response::error('Your session expired. Please log in again.', 401, ['code' => 'temp_token_invalid']);
}

// 5 wrong codes -> 15-minute lockout.
$limit = RateLimiter::hit('2fa:' . (int) $row['id'], 5, 900);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many incorrect codes. Try again later.', 429, ['retry_after' => $limit['retry_after']]);
}

if (empty($row['totp_secret']) || !TOTPService::verify((string) $row['totp_secret'], $code)) {
    Response::error('Incorrect authenticator code', 401, ['code' => 'totp_invalid']);
}

// Success: consume all temp tokens for this user.
$pdo->prepare('DELETE FROM totp_temp_tokens WHERE user_id = ?')->execute([(int) $row['id']]);

$user = $row;
$deletionGate = AccountDeletionService::gateLogin($pdo, $user);

$tokens = AuthTokens::issueFor($user);
$payload = ['message' => 'Logged in successfully.'] + $tokens;
if (!empty($deletionGate['restored'])) {
    $payload['message'] = 'Welcome back — your account deletion was cancelled and your account is active again.';
    $payload['account_restored'] = true;
}
Response::success($payload);
