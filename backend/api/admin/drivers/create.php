<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\DriverAccountService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_delivery_runs', 'manage_staff', 'edit_company_settings']);

$pdo = Database::pdo();
$body = Response::body();

try {
    $created = DriverAccountService::createDriverAccount($pdo, [
        'name'          => (string) ($body['name'] ?? ''),
        'email'         => (string) ($body['email'] ?? ''),
        'username'      => (string) ($body['username'] ?? ''),
        'phone'         => (string) ($body['phone'] ?? ''),
        'temp_password' => (string) ($body['temp_password'] ?? ''),
    ]);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'       => 'Driver account created.',
    'driver'        => $created,
    'temp_password' => $created['temp_password'],
], 201);
