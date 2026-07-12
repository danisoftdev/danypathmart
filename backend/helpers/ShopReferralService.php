<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Refer-a-shop program: bonus to referrer after N qualifying sales (Phase M5). */
final class ShopReferralService
{
    /** @return array{enabled:bool,bonus_amount:float,sales_target:int,count_on:string} */
    public static function settings(PDO $pdo): array
    {
        $flags = PlatformFeatures::load($pdo);
        $defaults = [
            'bonus_amount'  => 50.0,
            'sales_target'  => 10,
            'count_on'      => 'collected',
        ];

        try {
            $row = $pdo->query(
                'SELECT shop_referral_bonus_amount, shop_referral_sales_target, shop_referral_count_on
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($row !== false) {
                $defaults['bonus_amount'] = round((float) ($row['shop_referral_bonus_amount'] ?? 50), 2);
                $defaults['sales_target'] = max(1, (int) ($row['shop_referral_sales_target'] ?? 10));
                $countOn = (string) ($row['shop_referral_count_on'] ?? 'collected');
                $defaults['count_on'] = $countOn === 'paid' ? 'paid' : 'collected';
            }
        } catch (\Throwable) {
            // Migration not applied.
        }

        return [
            'enabled'      => $flags['shop_referral_commission_enabled'],
            'bonus_amount' => $defaults['bonus_amount'],
            'sales_target' => $defaults['sales_target'],
            'count_on'     => $defaults['count_on'],
        ];
    }

    /** @return array{valid:bool,shop_name?:string,referral_code?:string,referrer_type?:string,referrer_name?:string} */
    public static function validateCode(PDO $pdo, string $code): array
    {
        if (SubscriptionReferralService::settings($pdo)['enabled']) {
            $unified = SubscriptionReferralService::validateCode($pdo, $code);
            if (!$unified['valid']) {
                return ['valid' => false];
            }

            return [
                'valid'          => true,
                'shop_name'      => $unified['referrer_name'] ?? '',
                'referrer_name'  => $unified['referrer_name'] ?? '',
                'referrer_type'  => $unified['referrer_type'] ?? 'shop',
                'referral_code'  => $unified['referral_code'] ?? '',
                'shop_slug'      => $unified['shop_slug'] ?? null,
            ];
        }

        $shop = self::resolveShop($pdo, $code);
        if ($shop === null) {
            return ['valid' => false];
        }

        return [
            'valid'          => true,
            'shop_name'      => $shop['name'],
            'referral_code'  => $shop['referral_code'],
            'shop_slug'      => $shop['slug'],
        ];
    }

    /** @return array<string,mixed>|null */
    public static function resolveShop(PDO $pdo, string $code): ?array
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        $normalized = strtoupper(preg_replace('/\s+/', '', $code) ?? '');
        $stmt = $pdo->prepare(
            "SELECT * FROM shops WHERE status = 'active' AND (referral_code = ? OR slug = ?) LIMIT 1"
        );
        $stmt->execute([$normalized, strtolower($code)]);

        $row = $stmt->fetch();

        return $row === false ? null : ShopService::findById($pdo, (int) $row['id']);
    }

    public static function resolveReferrerId(PDO $pdo, string $code): ?int
    {
        $shop = self::resolveShop($pdo, $code);

        return $shop !== null ? (int) $shop['id'] : null;
    }

    public static function ensureReferralCode(PDO $pdo, int $shopId): string
    {
        $shop = ShopService::findById($pdo, $shopId);
        if ($shop === null) {
            throw new \InvalidArgumentException('Shop not found.');
        }
        if (!empty($shop['referral_code'])) {
            return (string) $shop['referral_code'];
        }

        $base = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($shop['slug'])) ?? '', 0, 8));
        if (strlen($base) < 4) {
            $base = 'SHOP';
        }

        for ($n = 0; $n < 100; $n++) {
            $try = $n === 0 ? $base : $base . $n;
            $chk = $pdo->prepare('SELECT 1 FROM shops WHERE referral_code = ?');
            $chk->execute([$try]);
            if ($chk->fetch() === false) {
                $pdo->prepare('UPDATE shops SET referral_code = ? WHERE id = ?')->execute([$try, $shopId]);

                return $try;
            }
        }

        $fallback = 'S' . $shopId . bin2hex(random_bytes(2));
        $pdo->prepare('UPDATE shops SET referral_code = ? WHERE id = ?')->execute([$fallback, $shopId]);

        return $fallback;
    }

    /** Link a newly approved shop to its referrer. */
    public static function registerReferredShop(PDO $pdo, int $referredShopId, ?int $referrerShopId): void
    {
        if ($referrerShopId === null || $referrerShopId <= 0 || $referrerShopId === $referredShopId) {
            return;
        }

        $referrer = ShopService::findById($pdo, $referrerShopId);
        if ($referrer === null || $referrer['status'] !== 'active') {
            return;
        }

        try {
            $pdo->prepare('UPDATE shops SET referred_by_shop_id = ? WHERE id = ?')->execute([$referrerShopId, $referredShopId]);
            $pdo->prepare(
                'INSERT IGNORE INTO shop_referrals (referrer_shop_id, referred_shop_id) VALUES (?, ?)'
            )->execute([$referrerShopId, $referredShopId]);
        } catch (\Throwable) {
            // M5 tables missing.
        }
    }

    /** Count qualifying sale when order is paid (if configured). */
    public static function onOrderPaid(PDO $pdo, int $orderId): void
    {
        if (self::settings($pdo)['count_on'] !== 'paid') {
            return;
        }
        self::processOrder($pdo, $orderId);
    }

    /** Count qualifying sale when order is collected/delivered (if configured). */
    public static function onOrderCollected(PDO $pdo, int $orderId): void
    {
        if (self::settings($pdo)['count_on'] !== 'collected') {
            return;
        }
        self::processOrder($pdo, $orderId);
    }

    private static function processOrder(PDO $pdo, int $orderId): void
    {
        if (SubscriptionReferralService::settings($pdo)['enabled']) {
            return;
        }

        $settings = self::settings($pdo);
        if (!$settings['enabled']) {
            return;
        }

        $orderStmt = $pdo->prepare('SELECT id, payment_status, status FROM orders WHERE id = ?');
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch();
        if ($order === false) {
            return;
        }

        if ($settings['count_on'] === 'paid' && ($order['payment_status'] ?? '') !== 'paid') {
            return;
        }
        if ($settings['count_on'] === 'collected') {
            $status = (string) ($order['status'] ?? '');
            if (!in_array($status, ['collected', 'delivered'], true)) {
                return;
            }
        }

        $stmt = $pdo->prepare(
            'SELECT DISTINCT p.shop_id FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND p.shop_id IS NOT NULL'
        );
        $stmt->execute([$orderId]);

        foreach ($stmt->fetchAll() as $row) {
            self::processSaleForReferredShop($pdo, $orderId, (int) $row['shop_id'], $settings);
        }
    }

    /** @param array{enabled:bool,bonus_amount:float,sales_target:int,count_on:string} $settings */
    private static function processSaleForReferredShop(PDO $pdo, int $orderId, int $referredShopId, array $settings): void
    {
        try {
            $shopStmt = $pdo->prepare('SELECT referred_by_shop_id FROM shops WHERE id = ?');
            $shopStmt->execute([$referredShopId]);
            $referrerId = $shopStmt->fetchColumn();
            if ($referrerId === false || $referrerId === null) {
                return;
            }
            $referrerId = (int) $referrerId;

            $refStmt = $pdo->prepare(
                'SELECT id, qualifying_sales_count, bonus_paid_at FROM shop_referrals
                 WHERE referred_shop_id = ? AND referrer_shop_id = ?'
            );
            $refStmt->execute([$referredShopId, $referrerId]);
            $referral = $refStmt->fetch();
            if ($referral === false) {
                $pdo->prepare(
                    'INSERT INTO shop_referrals (referrer_shop_id, referred_shop_id) VALUES (?, ?)'
                )->execute([$referrerId, $referredShopId]);
                $referralId = (int) $pdo->lastInsertId();
                $count = 0;
                $bonusPaid = null;
            } else {
                $referralId = (int) $referral['id'];
                $count = (int) $referral['qualifying_sales_count'];
                $bonusPaid = $referral['bonus_paid_at'];
            }

            if ($bonusPaid !== null) {
                return;
            }

            $dup = $pdo->prepare('SELECT 1 FROM shop_referral_orders WHERE order_id = ?');
            $dup->execute([$orderId]);
            if ($dup->fetch() !== false) {
                return;
            }

            $pdo->prepare('INSERT INTO shop_referral_orders (referral_id, order_id) VALUES (?, ?)')
                ->execute([$referralId, $orderId]);
            $count++;

            $pdo->prepare('UPDATE shop_referrals SET qualifying_sales_count = ? WHERE id = ?')
                ->execute([$count, $referralId]);

            if ($count >= $settings['sales_target']) {
                self::payBonus($pdo, $referralId, $referrerId, $referredShopId, $settings['bonus_amount']);
            }
        } catch (\Throwable) {
            // M5 schema not ready.
        }
    }

    private static function payBonus(PDO $pdo, int $referralId, int $referrerShopId, int $referredShopId, float $amount): void
    {
        if ($amount <= 0) {
            $pdo->prepare('UPDATE shop_referrals SET bonus_paid_at = NOW() WHERE id = ?')->execute([$referralId]);

            return;
        }

        $pdo->beginTransaction();
        try {
            $lock = $pdo->prepare(
                'SELECT bonus_paid_at FROM shop_referrals WHERE id = ? FOR UPDATE'
            );
            $lock->execute([$referralId]);
            $row = $lock->fetch();
            if ($row === false || $row['bonus_paid_at'] !== null) {
                $pdo->rollBack();

                return;
            }

            $referred = ShopService::findById($pdo, $referredShopId);
            $name = $referred['name'] ?? 'shop';
            ShopWalletService::creditAvailable(
                $pdo,
                $referrerShopId,
                $amount,
                null,
                "Refer-a-shop bonus — {$name} reached qualifying sales"
            );

            $pdo->prepare('UPDATE shop_referrals SET bonus_paid_at = NOW() WHERE id = ?')->execute([$referralId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array{referral_code:string,share_url:string,program:array,referred_shops:list<array<string,mixed>>} */
    public static function dashboardStats(PDO $pdo, int $shopId): array
    {
        $code = self::ensureReferralCode($pdo, $shopId);
        $shop = ShopService::findById($pdo, $shopId);
        $slug = $shop['slug'] ?? '';
        $program = self::settings($pdo);

        $referred = [];
        try {
            $stmt = $pdo->prepare(
                'SELECT r.*, s.name AS referred_shop_name, s.slug AS referred_shop_slug
                 FROM shop_referrals r
                 INNER JOIN shops s ON s.id = r.referred_shop_id
                 WHERE r.referrer_shop_id = ?
                 ORDER BY r.created_at DESC LIMIT 50'
            );
            $stmt->execute([$shopId]);
            $referred = array_map(static fn (array $r): array => [
                'id'                     => (int) $r['id'],
                'referred_shop_name'     => $r['referred_shop_name'],
                'referred_shop_slug'     => $r['referred_shop_slug'],
                'qualifying_sales_count' => (int) $r['qualifying_sales_count'],
                'sales_target'           => $program['sales_target'],
                'bonus_paid'             => $r['bonus_paid_at'] !== null,
                'bonus_paid_at'          => $r['bonus_paid_at'],
            ], $stmt->fetchAll());
        } catch (\Throwable) {
            // Tables missing.
        }

        return [
            'referral_code'   => $code,
            'share_url'       => '/stores/' . rawurlencode((string) ($shop['slug'] ?? '')),
            'store_url'       => '/stores/' . rawurlencode((string) ($shop['slug'] ?? '')),
            'storefront_mode' => ShopService::normalizeStorefrontMode($shop['storefront_mode'] ?? ShopService::DEFAULT_STOREFRONT_MODE),
            'referral_apply_url' => '/sell?ref=' . urlencode($code),
            'referral_apply_hint' => "Tell new sellers to enter {$code} when they apply",
            'program'         => SubscriptionReferralService::settings($pdo),
            'referred_shops'  => $referred,
            'subscription_referrals' => SubscriptionReferralService::referralsForShop($pdo, $shopId),
        ];
    }
}
