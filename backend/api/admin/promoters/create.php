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
} catch (\Throwable $e) {
    error_log('admin/promoters/create: ' . $e->getMessage());
    $hint = $e->getMessage();
    if (str_contains($hint, 'role') || str_contains($hint, 'Data truncated')) {
        Response::error(
            'Could not create promoter: the promoter role is missing in the database. Push/deploy so migration 070 can run.',
            500
        );
    }
    if (str_contains($hint, "promoters") || str_contains($hint, "doesn't exist") || str_contains($hint, 'Base table')) {
        Response::error(
            'Could not create promoter: promoters tables are missing. Push/deploy so migrations can run.',
            500
        );
    }
    Response::error('Could not create promoter: ' . $hint, 500);
}

Response::success(['message' => 'Promoter created.', 'promoter' => $promoter], 201);
