<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\KitBuilderService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Kit not found.', 404);
}

$pdo = Database::pdo();
KitBuilderService::delete($pdo, $id);

Response::success(['message' => 'Kit template deleted.', 'id' => $id]);
