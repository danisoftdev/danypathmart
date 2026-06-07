<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\EmployeeProfileService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::requireAny(['manage_employee_profiles', 'manage_staff']);



$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {

    Response::error('Employee not found.', 404);

}



try {

    $employee = EmployeeProfileService::update(Database::pdo(), $id, Response::body());

} catch (\InvalidArgumentException $e) {

    Response::error($e->getMessage(), 422);

}



Response::success(['message' => 'Employee profile updated.', 'employee' => $employee]);

