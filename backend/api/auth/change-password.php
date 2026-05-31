<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$current = (string) ($body['current_password'] ?? '');
$next    = (string) ($body['new_password'] ?? '');
$confirm = (string) ($body['confirm_password'] ?? '');

if ($current === '') {
    Response::error('Your current password is required.', 422);
}
if (!Validator::passwordStrong($next)) {
    Response::error('New password must be at least 8 characters with an uppercase letter and a number.', 422);
}
if ($next !== $confirm) {
    Response::error('New password and confirmation do not match.', 422);
}

$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([(int) $user['id']]);
$hash = (string) ($stmt->fetchColumn() ?: '');

if ($hash === '' || !password_verify($current, $hash)) {
    Response::error('Your current password is incorrect.', 401, ['code' => 'bad_current']);
}
if (password_verify($next, $hash)) {
    Response::error('New password must be different from your current password.', 422);
}

$pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([password_hash($next, PASSWORD_BCRYPT), (int) $user['id']]);

// Revoke every other session; keep the one making this request signed in.
$cookie = $_COOKIE[AuthTokens::REFRESH_COOKIE] ?? '';
if ($cookie !== '') {
    $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ? AND refresh_token_hash <> ?')
        ->execute([(int) $user['id'], hash('sha256', $cookie)]);
} else {
    $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([(int) $user['id']]);
}

Response::success(['message' => 'Password changed. Other devices have been signed out.']);
