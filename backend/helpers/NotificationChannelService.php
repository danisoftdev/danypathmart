<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Routes transactional + manual messages to SMS, WhatsApp, and push (when enabled). */
final class NotificationChannelService
{
    public static function resolvePhone(PDO $pdo, int $userId): ?string
    {
        $stmt = $pdo->prepare('SELECT phone FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $phone = trim((string) ($stmt->fetchColumn() ?: ''));
        if ($phone !== '') {
            return $phone;
        }

        $addr = $pdo->prepare(
            'SELECT phone FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC LIMIT 1'
        );
        $addr->execute([$userId]);
        $phone = trim((string) ($addr->fetchColumn() ?: ''));

        return $phone !== '' ? $phone : null;
    }

    public static function smsText(string $title, string $body): string
    {
        $text = trim($title . "\n" . $body);

        return mb_strlen($text) > 480 ? mb_substr($text, 0, 477) . '…' : $text;
    }

    /** Automatic / manual outbound SMS + WhatsApp for one customer. */
    public static function sendExternalToUser(
        PDO $pdo,
        int $userId,
        string $title,
        string $body,
        bool $sendSms = true,
        bool $sendWhatsApp = true
    ): array {
        $settings = MessagingIntegrationService::load($pdo);
        $phone = self::resolvePhone($pdo, $userId);
        $text = self::smsText($title, $body);
        $result = ['sms' => null, 'whatsapp' => null, 'phone' => $phone];

        if ($phone === null) {
            return $result;
        }

        if ($sendSms && $settings['sms_api_enabled'] && $settings['sms_configured']) {
            $result['sms'] = MessagingIntegrationService::sendSms($pdo, $phone, $text, $title);
        }
        if ($sendWhatsApp && $settings['whatsapp_api_enabled'] && $settings['whatsapp_configured']) {
            $result['whatsapp'] = MessagingIntegrationService::sendWhatsApp($pdo, $phone, $text, $title);
        }

        return $result;
    }

    /** Order + system updates: push + optional SMS/WhatsApp. */
    public static function notifyCustomer(
        PDO $pdo,
        int $userId,
        string $title,
        string $body,
        ?string $linkUrl = null,
        bool $push = true,
        bool $sms = true,
        bool $whatsapp = true
    ): void {
        NotificationService::notifyUser(
            $pdo,
            $userId,
            $title,
            $body,
            $linkUrl,
            'order_update',
            true,
            $push,
            $sms,
            $whatsapp
        );
    }
}
