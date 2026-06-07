<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\FinancialReport;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::require('view_reports');



$pdo = Database::pdo();



Response::success([

    'financial' => FinancialReport::build($pdo),

]);

