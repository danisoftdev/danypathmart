<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$sessionId = (int) ($_GET['id'] ?? 0);
if ($sessionId <= 0) {
    Response::error('Invalid session.', 422);
}

$stmt = $pdo->prepare('SELECT refresh_token_hash FROM user_sessions WHERE id = ? AND user_id = ?');
$stmt->execute([$sessionId, (int) $user['id']]);
$hash = $stmt->fetchColumn();
if ($hash === false) {
    Response::error('Session not found.', 404);
}

$pdo->prepare('DELETE FROM user_sessions WHERE id = ? AND user_id = ?')
    ->execute([$sessionId, (int) $user['id']]);

// If the revoked session is the current one, clear the cookie too.
$cookie = $_COOKIE[AuthTokens::REFRESH_COOKIE] ?? '';
if ($cookie !== '' && hash_equals((string) $hash, hash('sha256', $cookie))) {
    AuthTokens::clearRefreshCookie();
}

Response::success(['message' => 'Session signed out.']);
