<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterApplicationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'edit_company_settings']);

$pdo = Database::pdo();
$status = isset($_GET['status']) ? (string) $_GET['status'] : 'new';

Response::success([
    'applications' => PromoterApplicationService::listAll($pdo, $status),
]);
