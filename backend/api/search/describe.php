<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimiter;

/*
 * Customer follow-up to a no-match image search: attach a free-text
 * description to the alert so the admin knows what to source.
 */
$limit = RateLimiter::hit('describe:' . RateLimiter::clientIp(), 20, 600);
if (!$limit['allowed']) {
    Response::error('Too many requests. Please try again later.', 429, [
        'retry_after' => $limit['retry_after'],
    ]);
}

$body = Response::body();
$alertId = (int) ($body['alert_id'] ?? 0);
$description = trim((string) ($body['description'] ?? ''));

if ($alertId <= 0 || $description === '') {
    Response::error('A description is required.', 422);
}

$user = AuthMiddleware::optional();
$pdo = Database::pdo();

// Only update pending alerts; bind the author when known.
$stmt = $pdo->prepare(
    "UPDATE image_search_alerts
     SET search_query = ?
     WHERE id = ? AND status = 'pending'
       AND (user_id IS NULL OR user_id = ?)"
);
$stmt->execute([mb_substr($description, 0, 255), $alertId, $user['id'] ?? 0]);

Response::success(['message' => 'Thank you! Our team will look into sourcing this for you.']);
