<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Mailer;
use App\Helpers\OTPService;
use App\Helpers\Response;

$body = Response::body();
$userId = (int) ($body['user_id'] ?? 0);
$type   = (string) ($body['type'] ?? 'registration');

if (!in_array($type, ['registration', 'password_reset'], true)) {
    $type = 'registration';
}
if ($userId <= 0) {
    Response::error('user_id is required', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT id, name, email, status FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if ($user === false) {
    Response::error('Account not found', 404);
}
if ($type === 'registration' && $user['status'] === 'verified') {
    Response::error('This account is already verified. Please log in.', 409);
}

if (OTPService::issuedLastHour($userId, $type) >= (OTPService::RESEND_LIMIT_PER_HOUR + 1)) {
    Response::error('Too many code requests. Please try again later.', 429, ['code' => 'resend_limited']);
}

$otp = OTPService::issue($userId, $type);
$subject = $type === 'password_reset'
    ? 'Your DanyPathMart password reset code'
    : 'Your DanyPathMart verification code';
Mailer::send($user['email'], $user['name'], $subject, Mailer::otpEmail($otp, $type));

Response::success(['message' => 'A new code has been sent to your email.']);
