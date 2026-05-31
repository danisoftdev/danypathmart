<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Mailer;
use App\Helpers\Response;
use App\Helpers\StaffPermission;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireSuperAdmin();
$pdo = Database::pdo();
$body = Response::body();

$name     = trim((string) ($body['name'] ?? ''));
$email    = strtolower(trim((string) ($body['email'] ?? '')));
$username = trim((string) ($body['username'] ?? ''));
$roleName = trim((string) ($body['role_name'] ?? ''));
$tempPassword = (string) ($body['temp_password'] ?? '');
$permsInput = is_array($body['permissions'] ?? null) ? $body['permissions'] : [];

if (!Validator::nonEmpty($name)) {
    Response::error('Full name is required.', 422);
}
if (!Validator::email($email)) {
    Response::error('A valid email address is required.', 422);
}
if ($roleName === '') {
    $roleName = 'Staff';
}
if ($username !== '' && !Validator::username($username)) {
    Response::error('Username may only contain letters, numbers, dots, hyphens and underscores (3-60 chars).', 422);
}

// Generate a strong temp password when one is not supplied.
if ($tempPassword === '') {
    $tempPassword = 'Dpm' . bin2hex(random_bytes(4)) . random_int(10, 99) . '!';
} elseif (!Validator::passwordStrong($tempPassword)) {
    Response::error('Temporary password must be at least 8 characters and include an uppercase letter and a number.', 422);
}

// Uniqueness checks.
$check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$check->execute([$email]);
if ($check->fetchColumn() !== false) {
    Response::error('An account with this email already exists.', 409);
}

if ($username === '') {
    $base = preg_replace('/[^a-z0-9._-]/', '', strtolower(explode('@', $email)[0])) ?? 'staff';
    if (strlen($base) < 3) {
        $base = 'staff' . $base;
    }
    $base = substr($base, 0, 50);
    $candidate = $base;
    $suffix = 0;
    $u = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
    do {
        $u->execute([$candidate]);
        $taken = $u->fetchColumn() !== false;
        if ($taken) {
            $candidate = $base . (++$suffix);
        }
    } while ($taken);
    $username = $candidate;
} else {
    $u = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
    $u->execute([$username]);
    if ($u->fetchColumn() !== false) {
        Response::error('This username is already taken.', 409);
    }
}

$hash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);
$permissions = StaffPermission::sanitize($permsInput);

$pdo->beginTransaction();
try {
    $pdo->prepare(
        "INSERT INTO users (name, username, email, password_hash, role, status, totp_enabled)
         VALUES (?, ?, ?, ?, 'staff', 'verified', 0)"
    )->execute([$name, $username, $email, $hash]);
    $userId = (int) $pdo->lastInsertId();

    $pdo->prepare(
        'INSERT INTO staff_permissions (user_id, role_name, permissions, created_by)
         VALUES (?, ?, ?, ?)'
    )->execute([$userId, $roleName, json_encode($permissions), (int) $admin['id']]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

$loginUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/') . '/login';
Mailer::staffWelcome($email, $name, $tempPassword, $loginUrl);

Response::success([
    'message'       => 'Staff account created. Welcome email sent.',
    'id'            => $userId,
    'temp_password' => $tempPassword,
    'staff'         => [
        'id'          => $userId,
        'name'        => $name,
        'username'    => $username,
        'email'       => $email,
        'role'        => 'staff',
        'role_name'   => $roleName,
        'status'      => 'verified',
        'permissions' => $permissions,
    ],
], 201);
