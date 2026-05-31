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

$name  = trim((string) ($body['name'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));

if (!Validator::nonEmpty($name)) {
    Response::error('Your name is required.', 422);
}
if ($phone !== '' && !preg_match('/^[0-9+()\-\s]{6,30}$/', $phone)) {
    Response::error('Please enter a valid phone number.', 422);
}

$pdo->prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?')
    ->execute([$name, $phone !== '' ? $phone : null, (int) $user['id']]);

$stmt = $pdo->prepare(
    'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
     FROM users WHERE id = ?'
);
$stmt->execute([(int) $user['id']]);
$fresh = $stmt->fetch();

Response::success([
    'message' => 'Profile updated.',
    'user'    => AuthTokens::publicUser($fresh),
]);
