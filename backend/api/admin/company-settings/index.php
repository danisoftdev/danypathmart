<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CompanySettingsService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

try {
    $pdo = Database::pdo();
    $settings = CompanySettingsService::loadForAdmin($pdo);
    Response::success(['settings' => $settings]);
} catch (Throwable $e) {
    error_log('company-settings index: ' . $e->getMessage());
    Response::error('Could not load company settings from database.', 500, [
        'code' => 'company_settings_load_failed',
    ]);
}
