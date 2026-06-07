<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_products');

$pdo = Database::pdo();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Size guide not found.', 404);
}

$guide = SizeGuideService::getById($pdo, $id, true);
if ($guide === null) {
    Response::error('Size guide not found.', 404);
}

Response::success(['guide' => $guide]);
