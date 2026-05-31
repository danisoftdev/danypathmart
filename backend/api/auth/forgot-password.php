<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Mailer;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$body = Response::body();
$identifier = trim((string) ($body['identifier'] ?? ''));

// Always respond with the same message to prevent account enumeration.
$genericMessage = 'If an account matches that email or username, a reset link has been sent.';

// Light rate limit so the endpoint can't be abused to spam inboxes.
$limit = RateLimiter::hit('forgot:' . RateLimiter::clientIp(), 10, 600);
if (!$limit['allowed']) {
    Response::error('Too many requests. Please try again later.', 429, [
        'retry_after' => $limit['retry_after'],
    ]);
}

if ($identifier === '') {
    Response::success(['message' => $genericMessage]);
}

$pdo = Database::pdo();

// Email first, then case-insensitive username.
$stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE email = ? LIMIT 1');
$stmt->execute([strtolower($identifier)]);
$user = $stmt->fetch();

if ($user === false) {
    $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1');
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
}

if ($user !== false) {
    $userId = (int) $user['id'];

    // Invalidate any prior reset tokens for this user.
    $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ? AND type = 'password_reset'")
        ->execute([$userId]);

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    $expires = date('Y-m-d H:i:s', time() + 3600); // 1 hour

    $pdo->prepare(
        "INSERT INTO email_verifications (user_id, otp_hash, type, expires_at)
         VALUES (?, ?, 'password_reset', ?)"
    )->execute([$userId, $tokenHash, $expires]);

    $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
    $link = $frontend . '/reset-password?token=' . $token;

    Mailer::passwordResetLink((string) $user['email'], (string) $user['name'], $link);
}

Response::success(['message' => $genericMessage]);
