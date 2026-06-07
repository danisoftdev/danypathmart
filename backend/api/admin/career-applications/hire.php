<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\CareerService;
use App\Helpers\Mailer;
use App\Helpers\PositionPermissionService;
use App\Helpers\Response;
use App\Helpers\DriverAccountService;
use App\Helpers\StationAccountService;
use App\Helpers\StaffAccountService;
use App\Helpers\StaffPermission;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireAnyPermission(['manage_staff', 'hire_employees']);
$pdo = Database::pdo();
$body = Response::body();

$applicationId = (int) ($_GET['id'] ?? 0);
if ($applicationId <= 0) {
    Response::error('Application not found.', 404);
}

$stmt = $pdo->prepare(
    'SELECT a.id, a.job_post_id, a.job_title, a.name, a.email, a.phone, a.hired_user_id,
            p.job_type
     FROM job_applications a
     LEFT JOIN job_posts p ON p.id = a.job_post_id
     WHERE a.id = ?'
);
$stmt->execute([$applicationId]);
$app = $stmt->fetch();

if ($app === false) {
    Response::error('Application not found.', 404);
}
if ($app['hired_user_id'] !== null) {
    Response::error('This applicant already has an employee account.', 409);
}

$jobType = (string) ($app['job_type'] ?? '');
$roleLabel = $jobType !== '' ? CareerService::jobTypeLabel($pdo, $jobType) : (string) $app['job_title'];

$name = trim((string) ($body['name'] ?? $app['name'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? $app['email'] ?? '')));
$username = trim((string) ($body['username'] ?? ''));
$roleName = trim((string) ($body['role_name'] ?? $roleLabel));
$tempPassword = (string) ($body['temp_password'] ?? '');

$permissionsInput = is_array($body['permissions'] ?? null) ? $body['permissions'] : null;
if ($permissionsInput === null && $jobType !== '') {
    $permissionsInput = PositionPermissionService::getTemplate($pdo, $jobType);
}

$isDriver = CareerService::isDriverRole($pdo, $jobType);
$isStation = CareerService::isStationRole($pdo, $jobType);
$stationId = (int) ($body['pickup_station_id'] ?? 0);

try {
    if ($isDriver) {
        $created = DriverAccountService::createDriverAccount($pdo, [
            'name'          => $name,
            'email'         => $email,
            'username'      => $username,
            'phone'         => (string) ($app['phone'] ?? ''),
            'temp_password' => $tempPassword,
        ]);
        $created['permissions'] = [];
        $created['role_name'] = 'Delivery driver';
    } elseif ($isStation) {
        $created = StationAccountService::createStationStaffAccount($pdo, [
            'name'              => $name,
            'email'             => $email,
            'username'          => $username,
            'phone'             => (string) ($app['phone'] ?? ''),
            'pickup_station_id' => $stationId,
            'temp_password'     => $tempPassword,
        ]);
        $created['permissions'] = [];
        $created['role_name'] = 'Pickup station staff';
    } else {
        $created = StaffAccountService::createStaffAccount($pdo, (int) $admin['id'], [
            'name'          => $name,
            'email'         => $email,
            'username'      => $username,
            'role_name'     => $roleName,
            'temp_password' => $tempPassword,
            'permissions'   => $permissionsInput ?? StaffPermission::defaults(false),
        ]);
    }
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create employee account.', 500);
}

$pdo->prepare(
    'UPDATE job_applications SET hired_user_id = ?, hired_at = NOW() WHERE id = ?'
)->execute([$created['user_id'], $applicationId]);

$loginUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/') . '/login';
if ($isDriver) {
    Mailer::staffWelcome($created['email'], $created['name'], $created['temp_password'], $loginUrl . ' (use Driver portal at /driver after login)');
} elseif ($isStation) {
    Mailer::staffWelcome($created['email'], $created['name'], $created['temp_password'], $loginUrl . ' (use Station portal at /station after login)');
} else {
    Mailer::staffWelcome($created['email'], $created['name'], $created['temp_password'], $loginUrl);
}

Response::success([
    'message'       => 'Employee account created and linked to this application.',
    'application_id'=> $applicationId,
    'user_id'       => $created['user_id'],
    'temp_password' => $created['temp_password'],
    'staff'         => [
        'id'          => $created['user_id'],
        'name'        => $created['name'],
        'username'    => $created['username'],
        'email'       => $created['email'],
        'role_name'   => $created['role_name'] ?? '',
        'staff_id'    => $created['staff_id'] ?? null,
        'permissions' => $created['permissions'] ?? [],
    ],
], 201);
