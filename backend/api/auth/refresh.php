<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Jwt;
use App\Helpers\Response;

$refresh = $_COOKIE[AuthTokens::REFRESH_COOKIE] ?? '';
if ($refresh === '') {
    Response::error('No refresh token present', 401);
}

$pdo = Database::pdo();
$hash = hash('sha256', $refresh);

$stmt = $pdo->prepare(
    'SELECT s.id AS session_id, u.id, u.name, u.username, u.email, u.role, u.status, u.preferred_currency, u.totp_enabled
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = ? AND s.expires_at > NOW()'
);
$stmt->execute([$hash]);
$row = $stmt->fetch();

if ($row === false) {
    AuthTokens::clearRefreshCookie();
    Response::error('Invalid or expired refresh token', 401);
}

if ($row['status'] === 'disabled') {
    $pdo->prepare('DELETE FROM user_sessions WHERE id = ?')->execute([$row['session_id']]);
    AuthTokens::clearRefreshCookie();
    Response::error('Account disabled', 403);
}

// Rotate the refresh token (delete the old session, mint a fresh one).
$pdo->prepare('DELETE FROM user_sessions WHERE id = ?')->execute([$row['session_id']]);
$newRefresh = AuthTokens::createRefreshSession((int) $row['id']);
AuthTokens::setRefreshCookie($newRefresh);

$access = Jwt::issueAccess([
    'sub'      => (int) $row['id'],
    'role'     => $row['role'],
    'email'    => $row['email'],
    'username' => $row['username'],
]);

Response::success([
    'access_token' => $access,
    'token_type'   => 'Bearer',
    'expires_in'   => (int) (\App\Config\Env::int('JWT_EXPIRY', 900)),
    'user'         => AuthTokens::publicUser($row),
]);
