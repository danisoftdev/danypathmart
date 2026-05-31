<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Mailer;
use App\Helpers\OTPService;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$newEmail = strtolower(trim((string) ($body['new_email'] ?? '')));
$password = (string) ($body['current_password'] ?? '');

if (!Validator::email($newEmail)) {
    Response::error('Please enter a valid email address.', 422);
}
if ($password === '') {
    Response::error('Your current password is required.', 422);
}

$stmt = $pdo->prepare('SELECT email, password_hash FROM users WHERE id = ?');
$stmt->execute([(int) $user['id']]);
$row = $stmt->fetch();

if ($row === false || !password_verify($password, (string) $row['password_hash'])) {
    Response::error('Your current password is incorrect.', 401, ['code' => 'bad_password']);
}
if ($newEmail === strtolower((string) $row['email'])) {
    Response::error('That is already your email address.', 422, ['code' => 'same_email']);
}

// The new email must not belong to another account.
$taken = $pdo->prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?');
$taken->execute([$newEmail, (int) $user['id']]);
if ($taken->fetchColumn() !== false) {
    Response::error('That email is already in use.', 409, ['code' => 'email_taken']);
}

// Throttle: at most 3 change requests per hour.
$recent = $pdo->prepare(
    'SELECT COUNT(*) FROM email_change_requests WHERE user_id = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)'
);
$recent->execute([(int) $user['id']]);
if ((int) $recent->fetchColumn() >= 3) {
    Response::error('Too many requests. Please try again later.', 429, ['code' => 'rate_limited']);
}

$otp = OTPService::generate();
$expires = (new DateTimeImmutable('+' . OTPService::TTL_MINUTES . ' minutes'))->format('Y-m-d H:i:s');

// One active request per user.
$pdo->prepare('DELETE FROM email_change_requests WHERE user_id = ?')->execute([(int) $user['id']]);
$pdo->prepare(
    'INSERT INTO email_change_requests (user_id, new_email, otp_hash, expires_at, attempts)
     VALUES (?, ?, ?, ?, 0)'
)->execute([(int) $user['id'], $newEmail, OTPService::hash($otp), $expires]);

Mailer::send(
    $newEmail,
    (string) ($user['name'] ?? 'there'),
    'Confirm your new email - DanyPathMart',
    Mailer::otpEmail($otp, 'email_change')
);

Response::success([
    'message'   => 'We sent a 6-digit code to your new email address.',
    'new_email' => $newEmail,
]);
