<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\TOTPService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$body = Response::body();
$code = trim((string) ($body['totp_code'] ?? ''));

if ($code === '') {
    Response::error('Your current 6-digit code is required to disable 2FA', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?');
$stmt->execute([(int) $user['id']]);
$row = $stmt->fetch();

if ($row === false || (int) $row['totp_enabled'] !== 1 || empty($row['totp_secret'])) {
    Response::error('Two-factor authentication is not enabled.', 400);
}

// Password alone is NOT sufficient: a valid current TOTP code is required.
if (!TOTPService::verify((string) $row['totp_secret'], $code)) {
    Response::error('Incorrect authenticator code', 401);
}

$pdo->prepare(
    'UPDATE users
        SET totp_secret = NULL, totp_secret_pending = NULL, totp_enabled = 0, totp_backup_codes = NULL
      WHERE id = ?'
)->execute([(int) $user['id']]);
$pdo->prepare('DELETE FROM totp_temp_tokens WHERE user_id = ?')->execute([(int) $user['id']]);

Response::success(['message' => 'Two-factor authentication has been disabled.']);
