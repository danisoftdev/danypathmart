<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'edit_company_settings']);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
$pdo = Database::pdo();

Response::success(['promoters' => PromoterService::listAll($pdo, $status !== '' ? $status : null)]);
