<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$serviceFile = dirname(__DIR__, 2) . '/helpers/CompanySettingsService.php';
if (!is_file($serviceFile)) {
    error_log('company-settings: missing ' . $serviceFile);
    Response::error(
        'Server deploy incomplete: helpers/CompanySettingsService.php is missing. Pull latest code and redeploy the api folder.',
        500,
        ['code' => 'deploy_incomplete']
    );
}

require_once $serviceFile;

try {
    $pdo = Database::pdo();
    $settings = \App\Helpers\CompanySettingsService::loadForAdmin($pdo);
    Response::success(['settings' => $settings]);
} catch (Throwable $e) {
    error_log('company-settings index: ' . $e->getMessage());
    Response::error('Could not load company settings from database.', 500, [
        'code' => 'company_settings_load_failed',
    ]);
}
