<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();
$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;

Response::success(['data' => QuoteService::listAll($pdo, $status !== '' ? $status : null)]);
