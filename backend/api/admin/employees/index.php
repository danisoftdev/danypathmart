<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\EmployeeProfileService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::requireAny(['view_employees', 'manage_employee_profiles', 'manage_staff']);



Response::success(['data' => EmployeeProfileService::listWorkforce(Database::pdo())]);

