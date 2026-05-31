<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Helpers\TOTPService;
use App\Middleware\RateLimiter;

$body = Response::body();
$token = (string) ($body['temp_token'] ?? $body['token'] ?? '');
$code  = trim((string) ($body['backup_code'] ?? ''));

if ($token === '' || $code === '') {
    Response::error('temp_token and backup_code are required', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare(
    'SELECT t.id AS temp_id, u.id, u.name, u.username, u.email, u.role, u.status,
            u.preferred_currency, u.totp_enabled
     FROM totp_temp_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.expires_at > NOW()'
);
$stmt->execute([hash('sha256', $token)]);
$row = $stmt->fetch();

if ($row === false) {
    Response::error('Your session expired. Please log in again.', 401, ['code' => 'temp_token_invalid']);
}

$limit = RateLimiter::hit('2fa:' . (int) $row['id'], 5, 900);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many attempts. Try again later.', 429, ['retry_after' => $limit['retry_after']]);
}

if (!TOTPService::verifyBackupCode((int) $row['id'], $code)) {
    Response::error('Invalid or already-used backup code', 401, ['code' => 'backup_invalid']);
}

$pdo->prepare('DELETE FROM totp_temp_tokens WHERE user_id = ?')->execute([(int) $row['id']]);

$tokens = AuthTokens::issueFor($row);
Response::success([
    'message' => 'Logged in with a backup code.',
    'warning' => 'That backup code is now used. Consider regenerating your backup codes.',
] + $tokens);
