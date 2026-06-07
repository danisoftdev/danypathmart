<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CustomProofService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();
$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
$orderId = isset($_GET['order_id']) ? (int) $_GET['order_id'] : null;

$rows = CustomProofService::listForAdmin($pdo, $status, $orderId);

Response::success(['data' => $rows]);
