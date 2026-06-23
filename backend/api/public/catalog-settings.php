<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\InventoryService;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\Response;

$pdo = Database::pdo();

Response::success([
    'inventory'  => InventoryService::displaySettings($pdo),
    'messaging'  => [
        'push_notifications_enabled' => MessagingIntegrationService::load($pdo)['push_notifications_enabled'],
        'sms_api_enabled'            => MessagingIntegrationService::load($pdo)['sms_api_enabled'],
        'whatsapp_api_enabled'       => MessagingIntegrationService::load($pdo)['whatsapp_api_enabled'],
    ],
]);
