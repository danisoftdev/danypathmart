<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_messaging_integrations');

$body = Response::body();
$pdo = Database::pdo();

try {
    $pdo->prepare(
        'UPDATE company_settings SET
            push_notifications_enabled = ?,
            sms_api_enabled = ?,
            whatsapp_api_enabled = ?,
            vapid_public_key = ?,
            show_units_sold_badge = ?,
            show_low_stock_exact = ?,
            stock_decrement_on_payment = ?,
            updated_by = ?
         WHERE id = 1'
    )->execute([
        !empty($body['push_notifications_enabled']) ? 1 : 0,
        !empty($body['sms_api_enabled']) ? 1 : 0,
        !empty($body['whatsapp_api_enabled']) ? 1 : 0,
        trim((string) ($body['vapid_public_key'] ?? '')) ?: null,
        !empty($body['show_units_sold_badge']) ? 1 : 0,
        !empty($body['show_low_stock_exact']) ? 1 : 0,
        !empty($body['stock_decrement_on_payment']) ? 1 : 0,
        (int) $user['id'],
    ]);
} catch (Throwable) {
    Response::error('Trust & messaging migration not applied. Run migration 055.', 503);
}

Response::success([
    'message'  => 'Messaging & display settings saved.',
    'settings' => array_merge(MessagingIntegrationService::load($pdo), \App\Helpers\InventoryService::displaySettings($pdo)),
]);
