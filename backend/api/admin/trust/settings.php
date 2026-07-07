<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopSubscriptionReminderService;
use App\Helpers\TrustAutomationService;
use App\Helpers\StorefrontOrderService;
use App\Middleware\PermissionMiddleware;

PermissionMiddleware::require('manage_trust_automation');
$pdo = Database::pdo();

function trustSettingsPayload(PDO $pdo): array
{
    $trust = TrustAutomationService::settings($pdo);
    $reminders = ShopSubscriptionReminderService::settings($pdo);

    try {
        $row = $pdo->query(
            'SELECT storefront_unpaid_timeout_hours FROM company_settings ORDER BY id ASC LIMIT 1'
        )->fetch();
    } catch (\Throwable) {
        $row = false;
    }

    return [
        'trust_automation_enabled'           => $trust['enabled'],
        'trust_auto_cautions_threshold'      => $trust['cautions_threshold'],
        'trust_auto_restrict_threshold'      => $trust['restrict_threshold'],
        'shop_subscription_reminder_enabled' => $reminders['enabled'],
        'shop_subscription_reminder_days'      => implode(',', $reminders['days']),
        'storefront_unpaid_timeout_hours'    => max(1, (int) ($row['storefront_unpaid_timeout_hours'] ?? 48)),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    Response::success(['settings' => trustSettingsPayload($pdo)]);
}

$body = Response::body();
$enabled = !empty($body['trust_automation_enabled']) ? 1 : 0;
$cautions = max(1, (int) ($body['trust_auto_cautions_threshold'] ?? 3));
$restrict = max(1, (int) ($body['trust_auto_restrict_threshold'] ?? 3));
$reminderEnabled = !empty($body['shop_subscription_reminder_enabled']) ? 1 : 0;
$reminderDays = trim((string) ($body['shop_subscription_reminder_days'] ?? '7,1'));
$timeoutHours = max(1, min(168, (int) ($body['storefront_unpaid_timeout_hours'] ?? 48)));

$pdo->prepare(
    'UPDATE company_settings SET
        trust_automation_enabled = ?,
        trust_auto_cautions_threshold = ?,
        trust_auto_restrict_threshold = ?,
        shop_subscription_reminder_enabled = ?,
        shop_subscription_reminder_days = ?,
        storefront_unpaid_timeout_hours = ?
     WHERE id = 1'
)->execute([$enabled, $cautions, $restrict, $reminderEnabled, $reminderDays, $timeoutHours]);

Response::success(['settings' => trustSettingsPayload($pdo)]);
