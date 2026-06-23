<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** SMS / WhatsApp via generic HTTP (.env) + admin toggles in company_settings. */
final class MessagingIntegrationService
{
    /** @return array<string,mixed> */
    public static function load(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT sms_api_enabled, whatsapp_api_enabled, push_notifications_enabled, vapid_public_key
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return self::defaults();
        }

        if ($row === false) {
            return self::defaults();
        }

        return [
            'sms_api_enabled'            => (int) ($row['sms_api_enabled'] ?? 0) === 1,
            'whatsapp_api_enabled'       => (int) ($row['whatsapp_api_enabled'] ?? 0) === 1,
            'push_notifications_enabled' => (int) ($row['push_notifications_enabled'] ?? 1) === 1,
            'vapid_public_key'           => $row['vapid_public_key'] ?? null,
            'sms_configured'             => GenericHttpMessagingClient::isSmsConfigured(),
            'whatsapp_configured'        => GenericHttpMessagingClient::isWhatsAppConfigured(),
            'push_configured'            => trim((string) (Env::get('VAPID_PRIVATE_KEY') ?? '')) !== ''
                && trim((string) ($row['vapid_public_key'] ?? '')) !== '',
        ];
    }

    /** @return array<string,mixed> */
    public static function defaults(): array
    {
        return [
            'sms_api_enabled'            => false,
            'whatsapp_api_enabled'       => false,
            'push_notifications_enabled' => true,
            'vapid_public_key'           => null,
            'sms_configured'             => false,
            'whatsapp_configured'        => false,
            'push_configured'            => false,
        ];
    }

    /** @return array{ok:bool,error:?string} */
    public static function sendSms(PDO $pdo, string $phone, string $message, ?string $title = null): array
    {
        $settings = self::load($pdo);
        if (!$settings['sms_api_enabled']) {
            return ['ok' => false, 'error' => 'SMS API is disabled in admin settings.'];
        }
        if (!$settings['sms_configured']) {
            error_log('[DPM SMS] Enabled but SMS_API_URL not set in .env');

            return ['ok' => false, 'error' => 'SMS API not configured in .env.'];
        }

        $result = GenericHttpMessagingClient::sendSms($phone, $message, $title);
        if (!$result['ok']) {
            error_log('[DPM SMS] ' . ($result['error'] ?? 'send failed'));

            return ['ok' => false, 'error' => $result['error'] ?? 'SMS send failed.'];
        }

        return ['ok' => true, 'error' => null];
    }

    /** @return array{ok:bool,error:?string} */
    public static function sendWhatsApp(PDO $pdo, string $phone, string $message, ?string $title = null): array
    {
        $settings = self::load($pdo);
        if (!$settings['whatsapp_api_enabled']) {
            return ['ok' => false, 'error' => 'WhatsApp API is disabled in admin settings.'];
        }
        if (!$settings['whatsapp_configured']) {
            error_log('[DPM WhatsApp] Enabled but WHATSAPP_API_URL not set in .env');

            return ['ok' => false, 'error' => 'WhatsApp API not configured in .env.'];
        }

        $result = GenericHttpMessagingClient::sendWhatsApp($phone, $message, $title);
        if (!$result['ok']) {
            error_log('[DPM WhatsApp] ' . ($result['error'] ?? 'send failed'));

            return ['ok' => false, 'error' => $result['error'] ?? 'WhatsApp send failed.'];
        }

        return ['ok' => true, 'error' => null];
    }
}
