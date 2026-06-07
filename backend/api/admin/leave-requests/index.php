<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\LeaveRequestService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::requireAny(['view_leave_requests', 'manage_leave_requests']);



$status = isset($_GET['status']) ? (string) $_GET['status'] : null;



Response::success(['data' => LeaveRequestService::listAll(Database::pdo(), $status)]);

