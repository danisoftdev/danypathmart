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
    Response::error('A 6-digit code is required', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT totp_secret_pending FROM users WHERE id = ?');
$stmt->execute([(int) $user['id']]);
$pending = $stmt->fetchColumn();

if ($pending === false || $pending === null || $pending === '') {
    Response::error('No pending 2FA setup. Start setup first.', 400);
}

if (!TOTPService::verify((string) $pending, $code)) {
    Response::error('Incorrect code. Check your authenticator app and try again.', 401);
}

$backup = TOTPService::generateBackupCodes();

$pdo->prepare(
    'UPDATE users
        SET totp_secret = ?, totp_secret_pending = NULL, totp_enabled = 1, totp_backup_codes = ?
      WHERE id = ?'
)->execute([(string) $pending, json_encode($backup['hashed']), (int) $user['id']]);

Response::success([
    'message'      => 'Two-factor authentication is now enabled.',
    'backup_codes' => $backup['plain'],
    'note'         => 'Save these backup codes now. Each can be used once and they will not be shown again.',
]);
