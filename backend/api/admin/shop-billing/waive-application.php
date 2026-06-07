<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('waive_shop_fees');

$pdo = Database::pdo();
$body = Response::body();

$applicationId = (int) ($body['application_id'] ?? 0);
$note = trim((string) ($body['note'] ?? ''));

if ($applicationId <= 0) {
    Response::error('Application id is required.', 422);
}

try {
    ShopBillingService::waiveApplicationRegistration(
        $pdo,
        $applicationId,
        (int) $user['id'],
        $note !== '' ? $note : null
    );
} catch (\Throwable) {
    Response::error('Could not waive registration fee.', 500);
}

Response::success(['message' => 'Registration fee waived. Application is ready for review.']);
