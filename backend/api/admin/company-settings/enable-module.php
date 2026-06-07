<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\ModuleRolloutService;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::require('edit_company_settings');



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    Response::error('Method not allowed', 405);

}



$body = json_decode(file_get_contents('php://input') ?: '{}', true);

$moduleId = trim((string) ($body['module_id'] ?? ''));



if ($moduleId === '') {

    Response::error('module_id is required.', 422);

}



$pdo = Database::pdo();



try {

    $result = ModuleRolloutService::enable($pdo, $moduleId);

} catch (\InvalidArgumentException $e) {

    Response::error($e->getMessage(), 422);

} catch (\RuntimeException $e) {

    Response::error($e->getMessage(), 409);

}



Response::success($result);

