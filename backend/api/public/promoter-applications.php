<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterApplicationService;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$limit = RateLimiter::hit('promoter-apply:' . RateLimiter::clientIp(), 8, 600);
if (!$limit['allowed']) {
    Response::error('Too many applications. Try again later.', 429);
}

$body = Response::body();
$pdo = Database::pdo();

try {
    $result = PromoterApplicationService::submit($pdo, $body);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('public/promoter-applications: ' . $e->getMessage());
    Response::error('Could not submit your application. Please try again.', 500);
}

$emailSent = !empty($result['email_sent']);
Response::success([
    'message' => $emailSent
        ? 'Application received. Check your email for a copy of your details.'
        : 'Application received. If you do not get a confirmation email, check spam or contact us.',
    'id'         => $result['id'],
    'email'      => $result['email'],
    'email_sent' => $emailSent,
], 201);
