<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AdminAccountService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['delete_accounts', 'manage_delivery_runs', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
$body = Response::body();
$confirm = trim((string) ($body['confirm_email'] ?? ''));
$pdo = Database::pdo();

try {
    $deleted = AdminAccountService::delete(
        $pdo,
        (int) $admin['id'],
        $id,
        $confirm,
        ['driver']
    );
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success([
    'message' => 'Driver "' . $deleted['email'] . '" deleted permanently.',
    'deleted' => $deleted,
]);
