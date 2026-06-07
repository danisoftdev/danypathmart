<?php

declare(strict_types=1);

use App\Helpers\OAuthService;
use App\Helpers\Response;
use App\Middleware\RateLimiter;

$body = Response::body();
$provider = strtolower(trim((string) ($body['provider'] ?? '')));
$idToken = trim((string) ($body['id_token'] ?? ''));
$name = trim((string) ($body['name'] ?? ''));

if (!in_array($provider, ['google', 'microsoft', 'apple'], true)) {
    Response::error('Unknown provider.', 422);
}
if ($idToken === '') {
    Response::error('Missing id_token.', 422);
}

$limit = RateLimiter::hit('oauth-token:' . RateLimiter::clientIp(), 20, 600);
if (!$limit['allowed']) {
    header('Retry-After: ' . $limit['retry_after']);
    Response::error('Too many attempts. Try again later.', 429);
}

$extra = $name !== '' ? ['name' => $name] : [];
$tokens = OAuthService::loginWithIdToken($provider, $idToken, $extra);
Response::success(['message' => 'Signed in successfully.'] + $tokens);
