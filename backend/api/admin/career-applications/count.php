<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings', 'hire_employees']);

$pdo = Database::pdo();
$count = (int) $pdo->query('SELECT COUNT(*) FROM job_applications WHERE is_read = 0')->fetchColumn();

Response::success(['unread_count' => $count]);
