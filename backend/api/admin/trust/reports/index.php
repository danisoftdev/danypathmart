<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopReportService;
use App\Middleware\PermissionMiddleware;

PermissionMiddleware::require('resolve_shop_reports');
$pdo = Database::pdo();
$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;

Response::success([
    'reports' => ShopReportService::listForAdmin($pdo, $status !== '' ? $status : null),
    'reasons' => ShopReportService::REASONS,
]);
