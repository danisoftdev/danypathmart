<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\LeaveRequestService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



$user = AuthMiddleware::requireAdmin();

PermissionMiddleware::require('manage_leave_requests');



$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {

    Response::error('Leave request not found.', 404);

}



try {

    $request = LeaveRequestService::update(Database::pdo(), $id, Response::body(), (int) $user['id']);

} catch (\InvalidArgumentException $e) {

    Response::error($e->getMessage(), 422);

}



Response::success(['message' => 'Leave request updated.', 'request' => $request]);

