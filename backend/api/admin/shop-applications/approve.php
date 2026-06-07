<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopApplicationService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Application not found.', 404);
}

$pdo = Database::pdo();
$body = Response::body();
$note = trim((string) ($body['admin_note'] ?? ''));

try {
    $shop = ShopApplicationService::approve($pdo, $id, null, $note !== '' ? $note : null);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not approve application.', 500);
}

Response::success(['message' => 'Shop approved and created.', 'shop' => $shop]);
