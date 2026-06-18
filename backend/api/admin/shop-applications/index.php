<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopApplicationService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['approve_shop_applications', 'manage_marketplace', 'edit_company_settings']);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
$pdo = Database::pdo();

$newCount = (int) $pdo->query("SELECT COUNT(*) FROM shop_applications WHERE status = 'new'")->fetchColumn();

Response::success([
    'data'         => ShopApplicationService::list($pdo, $status),
    'new_count'    => $newCount,
]);
