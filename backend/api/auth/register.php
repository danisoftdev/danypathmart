<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Mailer;
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

// Email must be unique.
$check = $pdo->prepare('SELECT id, status FROM users WHERE email = ?');
$check->execute([$email]);
if ($check->fetch() !== false) {
    Response::error('An account with this email already exists', 409);
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
    $stmt = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
    do {
        $stmt->execute([$candidate]);
        $taken = $stmt->fetchColumn() !== false;
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
    $stmt = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetchColumn() !== false) {
        Response::error('This username is already taken', 409);
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
Mailer::send($email, $name, 'Verify your DanyPathMart account', Mailer::otpEmail($otp, 'registration'));

Response::success([
    'message'  => 'Account created. Check your email for the 6-digit verification code.',
    'user_id'  => $userId,
    'email'    => $email,
    'username' => $username,
], 201);
