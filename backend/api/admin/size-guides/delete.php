<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Size guide not found.', 404);
}

SizeGuideService::delete($pdo, $id);

Response::success(['message' => 'Size guide deleted.']);
