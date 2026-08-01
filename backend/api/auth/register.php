<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AvailabilityService;
use App\Helpers\Mailer;
use App\Helpers\NotificationService;
use App\Helpers\OTPService;
use App\Helpers\Response;
use App\Helpers\Validator;

$body = Response::body();

$name     = trim((string) ($body['name'] ?? ''));
$email    = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');
$confirm  = (string) ($body['confirm_password'] ?? $body['password_confirmation'] ?? $password);
$username = trim((string) ($body['username'] ?? ''));

if (!Validator::nonEmpty($name)) {
    Response::error('Full name is required', 422);
}
if (!Validator::email($email)) {
    Response::error('A valid email address is required', 422);
}
if (!Validator::passwordStrong($password)) {
    Response::error('Password must be at least 8 characters and include an uppercase letter and a number', 422);
}
if (!hash_equals($password, $confirm)) {
    Response::error('Passwords do not match', 422);
}
if ($username !== '' && !Validator::username($username)) {
    Response::error('Username may only contain letters, numbers, dots, hyphens and underscores (3-60 chars)', 422);
}

$pdo = Database::pdo();

if (mb_strlen($name) < 2 || mb_strlen($name) > 120) {
    Response::error('Full name must be between 2 and 120 characters', 422);
}

$emailCheck = AvailabilityService::check($pdo, 'email', $email);
if (!$emailCheck['available']) {
    Response::error($emailCheck['message'], 409);
}

// Resolve a unique username (auto-derive from the email local part when omitted).
$uniqueUsername = static function (string $base) use ($pdo): string {
    $base = preg_replace('/[^a-z0-9._-]/', '', strtolower($base)) ?? '';
    if (strlen($base) < 3) {
        $base = 'user' . $base;
    }
    $base = substr($base, 0, 50);
    $candidate = $base;
    $suffix = 0;
    do {
        $check = AvailabilityService::check($pdo, 'username', $candidate);
        $taken = !$check['available'];
        if ($taken) {
            $suffix++;
            $candidate = $base . $suffix;
        }
    } while ($taken);
    return $candidate;
};

if ($username === '') {
    $username = $uniqueUsername(explode('@', $email)[0]);
} else {
    $usernameCheck = AvailabilityService::check($pdo, 'username', $username);
    if (!$usernameCheck['available']) {
        Response::error($usernameCheck['message'], 409);
    }
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$insert = $pdo->prepare(
    'INSERT INTO users (name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$insert->execute([$name, $username, $email, $hash, 'customer', 'unverified']);
$userId = (int) $pdo->lastInsertId();

$otp = OTPService::issue($userId, 'registration');
$mailSent = false;
try {
    $mailSent = Mailer::send(
        $email,
        $name,
        'Verify your DanyPathMart account',
        Mailer::otpEmail($otp, 'registration')
    );
} catch (\Throwable $e) {
    error_log('Registration email failed for user #' . $userId . ': ' . $e->getMessage());
}

try {
    NotificationService::notifyAdmins(
        $pdo,
        'New registration — ' . $name,
        $email . ' registered (email verification pending).',
        '/admin/users',
        'admin_auth'
    );
} catch (\Throwable) {
    // Never block signup because of admin notifications.
}

Response::success([
    'message'  => $mailSent
        ? 'Account created. Check your email for the 6-digit verification code.'
        : 'Account created. If you do not receive an email shortly, use Resend code on the next screen.',
    'user_id'  => $userId,
    'email'    => $email,
    'username' => $username,
    'email_sent' => $mailSent,
], 201);
