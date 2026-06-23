<?php

declare(strict_types=1);

/**
 * Smoke test: universal SMS/WhatsApp HTTP client + channel routing.
 * Run: php backend/scripts/messaging-integration-test.php
 */

require __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));
    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Database;
use App\Config\Env;
use App\Helpers\GenericHttpMessagingClient;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\NotificationChannelService;

Env::load();
$pdo = Database::pdo();

$fail = 0;
$ok = static function (string $label) use (&$fail): void {
    echo "  OK: {$label}\n";
};
$check = static function (bool $cond, string $label) use (&$fail, $ok): void {
    if ($cond) {
        $ok($label);
    } else {
        echo "  FAIL: {$label}\n";
        $fail++;
    }
};

echo "Messaging integration smoke test\n\n";

$phone = GenericHttpMessagingClient::normalizePhone('0241234567');
$check(str_starts_with($phone, '233'), 'normalizePhone(024…) → 233…');

$settings = MessagingIntegrationService::load($pdo);
$check(array_key_exists('sms_configured', $settings), 'MessagingIntegrationService::load status fields');
$check(array_key_exists('push_configured', $settings), 'push_configured field');

$_ENV['SMS_API_URL'] = 'https://example.com/sms';
$_ENV['SMS_API_DRY_RUN'] = '1';
$_ENV['SMS_API_KEY'] = 'test_key';
putenv('SMS_API_URL=https://example.com/sms');
putenv('SMS_API_DRY_RUN=1');
putenv('SMS_API_KEY=test_key');

$check(GenericHttpMessagingClient::isSmsConfigured(), 'SMS configured when URL set');

$result = GenericHttpMessagingClient::sendSms('0241234567', 'Test message', 'Test');
$check($result['ok'] === true, 'SMS dry-run send');

$stmt = $pdo->query("SELECT id FROM users WHERE role = 'customer' LIMIT 1");
$customerId = (int) ($stmt->fetchColumn() ?: 0);
if ($customerId > 0) {
    $ext = NotificationChannelService::sendExternalToUser($pdo, $customerId, 'Test', 'Body', true, false);
    $check(is_array($ext), 'sendExternalToUser returns array');
} else {
    $ok('sendExternalToUser skipped (no customer)');
}

echo "\n";
if ($fail > 0) {
    echo "FAILED: {$fail} check(s)\n";
    exit(1);
}
echo "All checks passed.\n";
