<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'edit_company_settings']);

$body = Response::body();
$pdo = Database::pdo();

try {
    $promoter = PromoterService::create($pdo, $body, (int) $user['id']);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create promoter.', 500);
}

Response::success(['message' => 'Promoter created.', 'promoter' => $promoter], 201);
