<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** Web push subscriptions + in-app fallback when VAPID/API not configured. */
final class PushNotificationService
{
    public static function subscribe(PDO $pdo, int $userId, array $sub): void
    {
        $endpoint = trim((string) ($sub['endpoint'] ?? ''));
        $keys = is_array($sub['keys'] ?? null) ? $sub['keys'] : [];
        $p256dh = trim((string) ($keys['p256dh'] ?? ''));
        $auth = trim((string) ($keys['auth'] ?? ''));
        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            throw new \InvalidArgumentException('Invalid push subscription.');
        }

        $pdo->prepare(
            'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh),
                auth = VALUES(auth), user_agent = VALUES(user_agent)'
        )->execute([
            $userId,
            $endpoint,
            $p256dh,
            $auth,
            substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ]);
    }

    public static function unsubscribe(PDO $pdo, int $userId, string $endpoint): void
    {
        $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
            ->execute([$userId, $endpoint]);
    }

    public static function notifyUser(PDO $pdo, int $userId, string $title, string $body, ?string $url = null): void
    {
        NotificationService::notifyUser($pdo, $userId, $title, $body, $url, 'push');

        $settings = MessagingIntegrationService::load($pdo);
        if (!$settings['push_notifications_enabled']) {
            return;
        }

        $privateKey = trim((string) (Env::get('VAPID_PRIVATE_KEY') ?? ''));
        $publicKey = trim((string) ($settings['vapid_public_key'] ?? ''));
        if ($privateKey === '' || $publicKey === '') {
            return;
        }

        $payload = json_encode([
            'title' => $title,
            'body'  => $body,
            'url'   => $url,
        ], JSON_THROW_ON_ERROR);

        $stmt = $pdo->prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
        $stmt->execute([$userId]);
        foreach ($stmt->fetchAll() as $row) {
            self::sendRawPush(
                (string) $row['endpoint'],
                (string) $row['p256dh'],
                (string) $row['auth'],
                $payload,
                $publicKey,
                $privateKey
            );
        }
    }

    private static function sendRawPush(
        string $endpoint,
        string $p256dh,
        string $auth,
        string $payload,
        string $vapidPublic,
        string $vapidPrivate
    ): void {
        if (!class_exists(\Minishlink\WebPush\WebPush::class)) {
            error_log('[DPM Push] minishlink/web-push not installed — run composer require minishlink/web-push');

            return;
        }

        try {
            $authConfig = [
                'VAPID' => [
                    'subject'    => Env::get('VAPID_SUBJECT') ?: 'mailto:support@danypathmart.store',
                    'publicKey'  => $vapidPublic,
                    'privateKey' => $vapidPrivate,
                ],
            ];
            $webPush = new \Minishlink\WebPush\WebPush($authConfig);
            $webPush->queueNotification(
                \Minishlink\WebPush\Subscription::create([
                    'endpoint' => $endpoint,
                    'keys'     => ['p256dh' => $p256dh, 'auth' => $auth],
                ]),
                $payload
            );
            foreach ($webPush->flush() as $report) {
                if (!$report->isSuccess()) {
                    error_log('[DPM Push] failed: ' . $report->getReason());
                }
            }
        } catch (\Throwable $e) {
            error_log('[DPM Push] ' . $e->getMessage());
        }
    }
}
