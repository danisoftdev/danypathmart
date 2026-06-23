<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;
use RuntimeException;

/** SMS / WhatsApp API stubs — toggles in admin; real providers wired later. */
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
            'sms_configured'             => trim((string) (Env::get('SMS_API_KEY') ?? '')) !== '',
            'whatsapp_configured'        => trim((string) (Env::get('WHATSAPP_API_TOKEN') ?? '')) !== '',
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
        ];
    }

    public static function sendSms(PDO $pdo, string $phone, string $message): bool
    {
        $settings = self::load($pdo);
        if (!$settings['sms_api_enabled']) {
            return false;
        }
        if (!$settings['sms_configured']) {
            error_log('[DPM SMS stub] Would send to ' . $phone . ': ' . $message);

            return false;
        }
        // Future: Hubtel / Nsano integration using SMS_API_KEY
        error_log('[DPM SMS] API enabled but integration pending.');

        return false;
    }

    public static function sendWhatsAppTemplate(PDO $pdo, string $phone, string $message): bool
    {
        $settings = self::load($pdo);
        if (!$settings['whatsapp_api_enabled']) {
            return false;
        }
        if (!$settings['whatsapp_configured']) {
            error_log('[DPM WhatsApp stub] Would send to ' . $phone . ': ' . $message);

            return false;
        }
        error_log('[DPM WhatsApp] API enabled but integration pending.');

        return false;
    }
}
