<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterWalletService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'manage_marketplace', 'edit_company_settings']);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
$pdo = Database::pdo();

Response::success(['withdrawals' => PromoterWalletService::listWithdrawals($pdo, $status !== '' ? $status : null)]);
