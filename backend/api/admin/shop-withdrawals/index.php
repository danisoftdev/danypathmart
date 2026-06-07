<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopWalletService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'edit_company_settings']);

$pdo = Database::pdo();
$status = isset($_GET['status']) ? trim((string) $_GET['status']) : 'requested';

Response::success(['data' => ShopWalletService::listWithdrawals($pdo, $status !== 'all' ? $status : null)]);
