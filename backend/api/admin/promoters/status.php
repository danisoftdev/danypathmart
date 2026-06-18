<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Promoter not found.', 404);
}

$body = Response::body();
$status = trim((string) ($body['status'] ?? ''));
$pdo = Database::pdo();

try {
    PromoterService::setStatus($pdo, $id, $status, (int) $user['id']);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not update promoter.', 500);
}

Response::success(['message' => 'Promoter updated.', 'promoter' => PromoterService::findById($pdo, $id)]);
