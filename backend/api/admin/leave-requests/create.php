<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\HrSettings;

use App\Helpers\LeaveRequestService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::require('manage_leave_requests');



if (!HrSettings::load(Database::pdo())['leave_requests_enabled']) {

    Response::error('Leave requests are disabled in company settings.', 422);

}



try {

    $request = LeaveRequestService::create(Database::pdo(), Response::body());

} catch (\InvalidArgumentException $e) {

    Response::error($e->getMessage(), 422);

}



Response::success(['message' => 'Leave request created.', 'request' => $request], 201);

