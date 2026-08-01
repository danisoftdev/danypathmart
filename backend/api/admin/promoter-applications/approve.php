<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterApplicationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid application.', 422);
}

$body = Response::body();
$code = isset($body['code']) ? trim((string) $body['code']) : null;

$pdo = Database::pdo();
try {
    $result = PromoterApplicationService::approveAndCreate($pdo, $id, (int) $admin['id'], $code);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('admin/promoter-applications/approve: ' . $e->getMessage());
    Response::error('Could not create promoter account.', 500);
}

Response::success([
    'message'     => 'Promoter account created. Login details were emailed to the applicant.',
    'promoter'    => $result['promoter'],
    'application' => $result['application'],
]);
