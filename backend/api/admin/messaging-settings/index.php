<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\InventoryService;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_messaging_integrations');

$pdo = Database::pdo();

Response::success([
    'settings' => array_merge(
        MessagingIntegrationService::load($pdo),
        InventoryService::displaySettings($pdo)
    ),
    'env_hints' => [
        'sms' => [
            'url'     => 'SMS_API_URL',
            'key'     => 'SMS_API_KEY',
            'headers' => 'SMS_API_HEADERS (optional JSON)',
            'body'    => 'SMS_API_BODY (optional JSON template)',
        ],
        'whatsapp' => [
            'url'     => 'WHATSAPP_API_URL',
            'key'     => 'WHATSAPP_API_KEY or WHATSAPP_API_TOKEN',
            'headers' => 'WHATSAPP_API_HEADERS (optional JSON)',
            'body'    => 'WHATSAPP_API_BODY (optional JSON template)',
        ],
        'push' => [
            'private' => 'VAPID_PRIVATE_KEY in .env',
            'public'  => 'vapid_public_key in company_settings',
            'subject' => 'VAPID_SUBJECT in .env',
        ],
    ],
]);
