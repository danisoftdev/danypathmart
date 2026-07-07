<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Subscription expiry reminders for shop owners (email + in-app). */
final class ShopSubscriptionReminderService
{
    /** @return array{enabled:bool,days:list<int>} */
    public static function settings(PDO $pdo): array
    {
        $defaults = ['enabled' => true, 'days' => [7, 1]];

        try {
            $row = $pdo->query(
                'SELECT shop_subscription_reminder_enabled, shop_subscription_reminder_days
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        $days = [];
        foreach (explode(',', (string) ($row['shop_subscription_reminder_days'] ?? '7,1')) as $part) {
            $n = (int) trim($part);
            if ($n > 0) {
                $days[] = $n;
            }
        }
        if ($days === []) {
            $days = [7, 1];
        }
        rsort($days);

        return [
            'enabled' => (int) ($row['shop_subscription_reminder_enabled'] ?? 1) === 1,
            'days'    => $days,
        ];
    }

    /** Run daily — pre-expiry and on expiry day. */
    public static function runDue(PDO $pdo): int
    {
        $cfg = self::settings($pdo);
        if (!$cfg['enabled'] || !ShopBillingService::loadSettings($pdo)['shop_billing_enabled']) {
            return 0;
        }

        $sent = 0;
        $today = date('Y-m-d');

        $stmt = $pdo->query(
            "SELECT ss.shop_id, ss.period_end, s.name, s.slug, s.contact_email,
                    u.id AS owner_id, u.email AS owner_email, u.name AS owner_name
             FROM shop_subscriptions ss
             INNER JOIN shops s ON s.id = ss.shop_id
             LEFT JOIN shop_members sm ON sm.shop_id = s.id AND sm.role = 'owner'
             LEFT JOIN users u ON u.id = sm.user_id
             WHERE ss.status IN ('active', 'past_due')
               AND s.status = 'active'"
        );

        foreach ($stmt->fetchAll() as $row) {
            $shopId = (int) $row['shop_id'];
            $end = (string) ($row['period_end'] ?? '');
            if ($end === '') {
                continue;
            }

            $daysLeft = (int) floor((strtotime($end) - strtotime($today)) / 86400);

            foreach ($cfg['days'] as $before) {
                if ($daysLeft === $before) {
                    $type = 'days_before_' . $before;
                    if (self::sendReminder($pdo, $row, $type, $daysLeft)) {
                        $sent++;
                    }
                }
            }

            if ($daysLeft === 0) {
                if (self::sendReminder($pdo, $row, 'expired_today', 0)) {
                    $sent++;
                }
            }
        }

        return $sent;
    }

    /** @param array<string,mixed> $row */
    private static function sendReminder(PDO $pdo, array $row, string $type, int $daysLeft): bool
    {
        $shopId = (int) $row['shop_id'];
        $periodKey = (string) ($row['period_end'] ?? '') . ':' . $type;

        $chk = $pdo->prepare(
            'SELECT 1 FROM shop_subscription_reminder_log WHERE shop_id = ? AND reminder_type = ? LIMIT 1'
        );
        $chk->execute([$shopId, $periodKey]);
        if ($chk->fetchColumn() !== false) {
            return false;
        }

        $shopName = (string) $row['name'];
        $slug = (string) $row['slug'];
        $endDate = (string) $row['period_end'];
        $ownerEmail = (string) ($row['owner_email'] ?: $row['contact_email'] ?? '');
        $ownerId = (int) ($row['owner_id'] ?? 0);
        $ownerName = (string) ($row['owner_name'] ?? $shopName);

        if ($daysLeft > 0) {
            $subject = "Renew your shop — {$daysLeft} day(s) left";
            $body = "Your DanyPathMart shop <strong>{$shopName}</strong> subscription ends on <strong>{$endDate}</strong> "
                . "({$daysLeft} day(s) from now). Renew to keep your shop link <code>/stores/{$slug}</code> visible to customers.";
            $inApp = "Your shop subscription ends in {$daysLeft} day(s) ({$endDate}). Renew in Seller dashboard.";
        } else {
            $subject = 'Your shop link is now hidden — renewal required';
            $body = "Your shop <strong>{$shopName}</strong> subscription ended today ({$endDate}). "
                . 'Your public storefront is hidden until you renew in the Seller dashboard.';
            $inApp = 'Your shop subscription ended today. Renew in Seller dashboard to restore your shop link.';
        }

        if ($ownerEmail !== '') {
            Mailer::send(
                $ownerEmail,
                $ownerName,
                $subject,
                '<p>' . $body . '</p><p><a href="/seller">Open Seller dashboard</a></p>',
                strip_tags(str_replace(['<strong>', '</strong>', '<code>', '</code>'], '', $body))
            );
        }

        if ($ownerId > 0) {
            NotificationService::notifyUser(
                $pdo,
                $ownerId,
                $subject,
                $inApp,
                '/seller',
                'shop_billing'
            );
        }

        $pdo->prepare(
            'INSERT INTO shop_subscription_reminder_log (shop_id, reminder_type) VALUES (?, ?)'
        )->execute([$shopId, $periodKey]);

        return true;
    }
}
