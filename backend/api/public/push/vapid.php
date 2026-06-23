<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\Response;

$settings = MessagingIntegrationService::load(Database::pdo());

Response::success([
    'vapid_public_key' => $settings['vapid_public_key'] ?? null,
    'enabled'          => $settings['push_notifications_enabled'],
]);
