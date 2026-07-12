<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Mailer;
use App\Helpers\PasswordResetService;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$body = Response::body();
$identifier = trim((string) ($body['identifier'] ?? ''));

// Always respond with the same message to prevent account enumeration.
$genericMessage = 'If an account matches that email or username, a reset code and link have been sent.';

$ipLimit = RateLimiter::hit('forgot:ip:' . RateLimiter::clientIp(), 10, 600);
if (!$ipLimit['allowed']) {
    Response::error('Too many requests. Please try again later.', 429, [
        'retry_after' => $ipLimit['retry_after'],
        'code'        => 'rate_limited',
    ]);
}

if ($identifier === '') {
    Response::success(['message' => $genericMessage]);
}

// Per-identifier throttle (hashed so emails aren't stored in rate-limit filenames).
$idLimit = RateLimiter::hit('forgot:id:' . hash('sha256', strtolower($identifier)), 5, 600);
if (!$idLimit['allowed']) {
    // Still return generic success to avoid leaking that the identifier is being targeted.
    Response::success(['message' => $genericMessage]);
}

$pdo = Database::pdo();
$user = PasswordResetService::findResettableUser($pdo, $identifier);

if ($user !== null) {
    try {
        $issued = PasswordResetService::issue($pdo, $user['id']);
        $sent = Mailer::passwordResetEmail(
            $user['email'],
            $user['name'],
            $issued['link'],
            $issued['otp']
        );
        if (!$sent) {
            error_log('Password reset email failed for user #' . $user['id'] . ': ' . (Mailer::lastError() ?? 'unknown'));
        }
    } catch (\RuntimeException $e) {
        // Per-user hour cap — keep response generic.
        error_log('Password reset issue blocked: ' . $e->getMessage());
    } catch (\Throwable $e) {
        error_log('Password reset issue failed: ' . $e->getMessage());
    }
}

Response::success(['message' => $genericMessage]);
