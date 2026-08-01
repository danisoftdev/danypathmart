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

Response::success([
    'message' => 'Application received. Check your email for a copy of your details.',
    'id'      => $result['id'],
    'email'   => $result['email'],
], 201);
