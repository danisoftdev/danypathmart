<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** One-time commission on first shop registration subscription payment. */
final class SubscriptionReferralService
{
    /** @return array{enabled:bool,percent:float,sources:string} */
    public static function settings(PDO $pdo): array
    {
        $flags = PlatformFeatures::load($pdo);
        $defaults = ['percent' => 15.0, 'sources' => 'both'];

        try {
            $row = $pdo->query(
                'SELECT subscription_referral_percent, subscription_referral_sources
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($row !== false) {
                $defaults['percent'] = max(0.0, min(100.0, (float) ($row['subscription_referral_percent'] ?? 15)));
                $src = (string) ($row['subscription_referral_sources'] ?? 'both');
                $defaults['sources'] = in_array($src, ['both', 'promoter', 'shop'], true) ? $src : 'both';
            }
        } catch (\Throwable) {
        }

        return [
            'enabled' => $flags['shop_referral_commission_enabled'],
            'percent' => round($defaults['percent'], 2),
            'sources' => $defaults['sources'],
        ];
    }

    /** @return array{valid:bool,referrer_type?:string,referrer_name?:string,referral_code?:string} */
    public static function validateCode(PDO $pdo, string $code): array
    {
        $resolved = self::resolveReferrer($pdo, $code);
        if ($resolved === null) {
            return ['valid' => false];
        }

        return [
            'valid'          => true,
            'referrer_type'  => $resolved['type'],
            'referrer_name'  => $resolved['name'],
            'referral_code'  => $resolved['code'],
            'shop_slug'      => $resolved['shop_slug'] ?? null,
        ];
    }

    /**
     * @return array{type:string,id:int,code:string,name:string,shop_slug?:string}|null
     */
    public static function resolveReferrer(PDO $pdo, string $code): ?array
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled']) {
            return null;
        }

        $normalized = strtoupper(preg_replace('/\s+/', '', trim($code)) ?? '');
        if ($normalized === '') {
            return null;
        }

        if (in_array($settings['sources'], ['both', 'promoter'], true)) {
            try {
                $stmt = $pdo->prepare(
                    "SELECT p.id, p.display_name, p.code FROM promoters p
                     WHERE p.status = 'active' AND p.code = ? LIMIT 1"
                );
                $stmt->execute([$normalized]);
                $row = $stmt->fetch();
                if ($row !== false) {
                    return [
                        'type' => 'promoter',
                        'id'   => (int) $row['id'],
                        'code' => (string) $row['code'],
                        'name' => (string) $row['display_name'],
                    ];
                }
            } catch (\Throwable) {
            }
        }

        if (in_array($settings['sources'], ['both', 'shop'], true)) {
            $shop = ShopReferralService::resolveShop($pdo, $code);
            if ($shop !== null) {
                return [
                    'type'       => 'shop',
                    'id'         => (int) $shop['id'],
                    'code'       => (string) ($shop['referral_code'] ?? $normalized),
                    'name'       => (string) $shop['name'],
                    'shop_slug'  => (string) ($shop['slug'] ?? ''),
                ];
            }
        }

        return null;
    }

    /** @return array{type:string,id:int,code:string}|null */
    public static function attributionFromApplication(array $app): ?array
    {
        $type = $app['referred_by_type'] ?? null;
        if ($type === 'promoter' && !empty($app['referred_by_promoter_id'])) {
            return ['type' => 'promoter', 'id' => (int) $app['referred_by_promoter_id']];
        }
        if ($type === 'shop' && !empty($app['referred_by_shop_id'])) {
            return ['type' => 'shop', 'id' => (int) $app['referred_by_shop_id']];
        }
        if (!empty($app['referred_by_shop_id'])) {
            return ['type' => 'shop', 'id' => (int) $app['referred_by_shop_id']];
        }

        return null;
    }

    public static function payOnRegistration(PDO $pdo, int $applicationId, float $amountGhs, string $paystackRef): void
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled'] || $settings['percent'] <= 0 || $amountGhs <= 0) {
            return;
        }

        $app = ShopApplicationService::findById($pdo, $applicationId);
        if ($app === null || !empty($app['referral_commission_paid'])) {
            return;
        }

        $attr = self::attributionFromApplication($app);
        if ($attr === null) {
            return;
        }

        if ($attr['type'] === 'promoter' && $settings['sources'] === 'shop') {
            return;
        }
        if ($attr['type'] === 'shop' && $settings['sources'] === 'promoter') {
            return;
        }

        $commission = round($amountGhs * ($settings['percent'] / 100), 2);
        if ($commission <= 0) {
            return;
        }

        $pdo->beginTransaction();
        try {
            $lock = $pdo->prepare(
                'SELECT referral_commission_paid, referred_by_type, referred_by_shop_id, referred_by_promoter_id
                 FROM shop_applications WHERE id = ? FOR UPDATE'
            );
            $lock->execute([$applicationId]);
            $row = $lock->fetch();
            if ($row === false || (int) ($row['referral_commission_paid'] ?? 0) === 1) {
                $pdo->rollBack();

                return;
            }

            $shopId = $attr['type'] === 'shop' ? $attr['id'] : null;
            $promoterId = $attr['type'] === 'promoter' ? $attr['id'] : null;

            $pdo->prepare(
                'INSERT INTO subscription_referral_earnings
                    (application_id, referrer_type, referrer_shop_id, referrer_promoter_id,
                     subscription_amount, commission_percent, commission_amount, paystack_ref, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $applicationId,
                $attr['type'],
                $shopId,
                $promoterId,
                $amountGhs,
                $settings['percent'],
                $commission,
                $paystackRef,
                'pending',
            ]);
            $earningId = (int) $pdo->lastInsertId();

            $business = (string) ($app['business_name'] ?? 'new shop');
            $note = "Subscription referral — {$business} (pending approval)";

            if ($attr['type'] === 'shop') {
                ShopWalletService::creditReferralPending($pdo, $attr['id'], $commission, $earningId, $note);
            } else {
                PromoterWalletService::creditPending($pdo, $attr['id'], $commission, $earningId, $note);
            }

            $pdo->prepare('UPDATE shop_applications SET referral_commission_paid = 1 WHERE id = ?')
                ->execute([$applicationId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function releaseOnApprove(PDO $pdo, int $applicationId): void
    {
        try {
            $stmt = $pdo->prepare(
                "SELECT * FROM subscription_referral_earnings
                 WHERE application_id = ? AND status = 'pending' LIMIT 1"
            );
            $stmt->execute([$applicationId]);
            $earning = $stmt->fetch();
            if ($earning === false) {
                return;
            }

            $amount = round((float) $earning['commission_amount'], 2);
            $earningId = (int) $earning['id'];
            $type = (string) $earning['referrer_type'];

            $pdo->beginTransaction();
            try {
                if ($type === 'shop' && $earning['referrer_shop_id']) {
                    ShopWalletService::releaseReferralPending($pdo, (int) $earning['referrer_shop_id'], $amount, $earningId);
                } elseif ($type === 'promoter' && $earning['referrer_promoter_id']) {
                    PromoterWalletService::releasePending($pdo, (int) $earning['referrer_promoter_id'], $amount, $earningId);
                }

                $pdo->prepare(
                    "UPDATE subscription_referral_earnings SET status = 'available', released_at = NOW() WHERE id = ?"
                )->execute([$earningId]);
                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
        } catch (\Throwable) {
        }
    }

    public static function reverseOnReject(PDO $pdo, int $applicationId): void
    {
        try {
            $stmt = $pdo->prepare(
                "SELECT * FROM subscription_referral_earnings
                 WHERE application_id = ? AND status IN ('pending','available') LIMIT 1"
            );
            $stmt->execute([$applicationId]);
            $earning = $stmt->fetch();
            if ($earning === false) {
                return;
            }

            $amount = round((float) $earning['commission_amount'], 2);
            $earningId = (int) $earning['id'];
            $status = (string) $earning['status'];
            $type = (string) $earning['referrer_type'];

            $pdo->beginTransaction();
            try {
                if ($status === 'pending') {
                    if ($type === 'shop' && $earning['referrer_shop_id']) {
                        ShopWalletService::reverseReferralPending($pdo, (int) $earning['referrer_shop_id'], $amount, $earningId);
                    } elseif ($type === 'promoter' && $earning['referrer_promoter_id']) {
                        PromoterWalletService::reversePending($pdo, (int) $earning['referrer_promoter_id'], $amount, $earningId);
                    }
                } elseif ($status === 'available') {
                    if ($type === 'shop' && $earning['referrer_shop_id']) {
                        ShopWalletService::reverseReferralAvailable($pdo, (int) $earning['referrer_shop_id'], $amount, $earningId);
                    } elseif ($type === 'promoter' && $earning['referrer_promoter_id']) {
                        PromoterWalletService::reverseAvailable($pdo, (int) $earning['referrer_promoter_id'], $amount, $earningId);
                    }
                }

                $pdo->prepare("UPDATE subscription_referral_earnings SET status = 'reversed' WHERE id = ?")
                    ->execute([$earningId]);
                $pdo->prepare('UPDATE shop_applications SET referral_commission_paid = 0 WHERE id = ?')
                    ->execute([$applicationId]);
                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
        } catch (\Throwable) {
        }
    }

    /** @return list<array<string,mixed>> */
    public static function referralsForShop(PDO $pdo, int $shopId): array
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT e.*, a.business_name, a.status AS application_status, a.shop_id AS referred_shop_id
                 FROM subscription_referral_earnings e
                 INNER JOIN shop_applications a ON a.id = e.application_id
                 WHERE e.referrer_type = ? AND e.referrer_shop_id = ?
                 ORDER BY e.created_at DESC LIMIT 50'
            );
            $stmt->execute(['shop', $shopId]);

            return array_map(static fn (array $r): array => [
                'application_id'   => (int) $r['application_id'],
                'business_name'    => $r['business_name'],
                'application_status' => $r['application_status'],
                'referred_shop_id' => $r['referred_shop_id'] !== null ? (int) $r['referred_shop_id'] : null,
                'commission_amount'=> round((float) $r['commission_amount'], 2),
                'status'           => $r['status'],
                'created_at'       => $r['created_at'],
                'released_at'      => $r['released_at'],
            ], $stmt->fetchAll());
        } catch (\Throwable) {
            return [];
        }
    }

    /** @return list<array<string,mixed>> */
    public static function referralsForPromoter(PDO $pdo, int $promoterId): array
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT e.*, a.business_name, a.status AS application_status, a.shop_id AS referred_shop_id
                 FROM subscription_referral_earnings e
                 INNER JOIN shop_applications a ON a.id = e.application_id
                 WHERE e.referrer_type = ? AND e.referrer_promoter_id = ?
                 ORDER BY e.created_at DESC LIMIT 50'
            );
            $stmt->execute(['promoter', $promoterId]);

            return array_map(static fn (array $r): array => [
                'application_id'   => (int) $r['application_id'],
                'business_name'    => $r['business_name'],
                'application_status' => $r['application_status'],
                'referred_shop_id' => $r['referred_shop_id'] !== null ? (int) $r['referred_shop_id'] : null,
                'commission_amount'=> round((float) $r['commission_amount'], 2),
                'status'           => $r['status'],
                'created_at'       => $r['created_at'],
                'released_at'      => $r['released_at'],
            ], $stmt->fetchAll());
        } catch (\Throwable) {
            return [];
        }
    }

    /** @return array{referral_total:float,sales_total:float} */
    public static function shopWalletBreakdown(PDO $pdo, int $shopId): array
    {
        $referral = 0.0;
        $sales = 0.0;
        try {
            $stmt = $pdo->prepare(
                "SELECT type, SUM(amount) AS total FROM shop_wallet_transactions
                 WHERE shop_id = ? AND balance_bucket = 'available' AND amount > 0
                 GROUP BY type"
            );
            $stmt->execute([$shopId]);
            foreach ($stmt->fetchAll() as $row) {
                $t = (string) $row['type'];
                $sum = round((float) $row['total'], 2);
                if (str_contains($t, 'subscription_referral') || $t === 'referral_bonus') {
                    $referral += $sum;
                } elseif (str_contains($t, 'order_earning') || $t === 'release_to_available') {
                    $sales += $sum;
                }
            }
        } catch (\Throwable) {
        }

        return ['referral_total' => round($referral, 2), 'sales_total' => round($sales, 2)];
    }
}
