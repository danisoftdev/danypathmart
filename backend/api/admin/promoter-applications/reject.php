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
$note = isset($body['admin_note']) ? trim((string) $body['admin_note']) : null;

$pdo = Database::pdo();
try {
    PromoterApplicationService::reject($pdo, $id, (int) $admin['id'], $note);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Application rejected.']);
