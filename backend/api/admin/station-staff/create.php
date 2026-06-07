<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\StationAccountService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_station_staff', 'edit_company_settings']);

$pdo = Database::pdo();
$body = Response::body();

try {
    $created = StationAccountService::createStationStaffAccount($pdo, [
        'name'              => (string) ($body['name'] ?? ''),
        'email'             => (string) ($body['email'] ?? ''),
        'username'          => (string) ($body['username'] ?? ''),
        'phone'             => (string) ($body['phone'] ?? ''),
        'pickup_station_id' => (int) ($body['pickup_station_id'] ?? 0),
        'temp_password'     => (string) ($body['temp_password'] ?? ''),
    ]);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message'       => 'Station staff account created.',
    'staff'         => $created,
    'temp_password' => $created['temp_password'],
], 201);
