<?php

declare(strict_types=1);

use App\Helpers\OAuthService;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$body = Response::body();
$ticket = trim((string) ($body['ticket'] ?? ''));

if ($ticket === '') {
    Response::error('Missing sign-in ticket.', 422);
}

$limit = RateLimiter::hit('oauth-exchange:' . RateLimiter::clientIp(), 20, 600);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many attempts. Try again later.', 429);
}

$tokens = OAuthService::exchangeTicket($ticket);
Response::success(['message' => 'Signed in successfully.'] + $tokens);
