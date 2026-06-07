<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Mailer;
use App\Helpers\Response;
use App\Helpers\StaffAccountService;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireAnyPermission(['manage_staff']);
$pdo = Database::pdo();
$body = Response::body();

try {
    $created = StaffAccountService::createStaffAccount($pdo, (int) $admin['id'], [
        'name'          => $body['name'] ?? '',
        'email'         => $body['email'] ?? '',
        'username'      => $body['username'] ?? '',
        'role_name'     => $body['role_name'] ?? '',
        'temp_password' => $body['temp_password'] ?? '',
        'permissions'   => is_array($body['permissions'] ?? null) ? $body['permissions'] : [],
    ]);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create staff account.', 500);
}

$loginUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/') . '/login';
Mailer::staffWelcome(
    $created['email'],
    $created['name'],
    $created['temp_password'],
    $loginUrl
);

Response::success([
    'message'       => 'Staff account created. Welcome email sent.',
    'id'            => $created['user_id'],
    'temp_password' => $created['temp_password'],
    'staff'         => [
        'id'          => $created['user_id'],
        'name'        => $created['name'],
        'username'    => $created['username'],
        'email'       => $created['email'],
        'role'        => 'staff',
        'role_name'   => $created['role_name'],
        'staff_id'    => $created['staff_id'],
        'status'      => 'verified',
        'permissions' => $created['permissions'],
    ],
], 201);
