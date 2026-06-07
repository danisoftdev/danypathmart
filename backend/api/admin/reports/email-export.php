<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\WeeklyExportService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_reports');

$pdo = Database::pdo();
$body = Response::body();

$days = isset($body['days']) ? max(1, min(90, (int) $body['days'])) : 7;
$email = trim((string) ($body['email'] ?? ''));

if ($email === '') {
    $settings = WeeklyExportService::settings($pdo);
    $email = $settings['email'] ?? '';
}

if ($email === '') {
    $row = $pdo->query('SELECT email FROM company_settings ORDER BY id ASC LIMIT 1')->fetch();
    $email = trim((string) ($row['email'] ?? ''));
}

if ($email === '') {
    Response::error('Set a recipient email in scheduled export settings or company contact email.', 422);
}

$result = WeeklyExportService::sendOrdersCsv($pdo, $email, $days);

if (!$result['sent']) {
    Response::error($result['message'], 500);
}

Response::success($result);
