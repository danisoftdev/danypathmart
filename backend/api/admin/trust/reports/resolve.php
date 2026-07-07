<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopReportService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::authenticate();
PermissionMiddleware::require('resolve_shop_reports');
$pdo = Database::pdo();
$body = Response::body();

$reportId = (int) ($body['report_id'] ?? 0);
$status = trim((string) ($body['status'] ?? ''));
$adminNote = isset($body['admin_note']) ? trim((string) $body['admin_note']) : null;

if ($reportId <= 0) {
    Response::error('Report id required.', 422);
}

try {
    $report = ShopReportService::resolve($pdo, $reportId, (int) $admin['id'], $status, $adminNote);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['report' => $report]);
