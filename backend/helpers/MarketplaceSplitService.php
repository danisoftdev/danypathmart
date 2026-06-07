<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Commission splits when customers pay DPM (Phase M4). */
final class MarketplaceSplitService
{
    public static function earningsReleaseTrigger(PDO $pdo): string
    {
        try {
            $v = $pdo->query(
                'SELECT shop_earnings_release_on FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetchColumn();
        } catch (\Throwable) {
            return 'collected';
        }

        return $v === 'paid' ? 'paid' : 'collected';
    }

    /** Record pending shop earnings when an order is paid. */
    public static function recordOnPayment(PDO $pdo, int $orderId): void
    {
        if (!PlatformFeatures::load($pdo)['marketplace_enabled']) {
            return;
        }

        $check = $pdo->prepare('SELECT COUNT(*) FROM shop_order_earnings WHERE order_id = ?');
        $check->execute([$orderId]);
        if ((int) $check->fetchColumn() > 0) {
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT p.shop_id, SUM(oi.quantity * oi.unit_price) AS gross
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND p.shop_id IS NOT NULL
             GROUP BY p.shop_id'
        );
        $stmt->execute([$orderId]);
        $groups = $stmt->fetchAll();
        if ($groups === []) {
            return;
        }

        foreach ($groups as $g) {
            $shopId = (int) $g['shop_id'];
            $shop = ShopService::findById($pdo, $shopId);
            if ($shop === null || $shop['status'] !== 'active') {
                continue;
            }

            $gross = round((float) $g['gross'], 2);
            if ($gross <= 0) {
                continue;
            }

            $rate = ShopService::commissionForShop($pdo, $shop);
            $commission = round($gross * ($rate / 100), 2);
            $net = round($gross - $commission, 2);

            $pdo->prepare(
                'INSERT INTO shop_order_earnings
                    (order_id, shop_id, gross_amount, commission_rate, commission_amount, net_amount, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$orderId, $shopId, $gross, $rate, $commission, $net, 'pending']);

            ShopWalletService::creditPending($pdo, $shopId, $net, $orderId);

            if (self::earningsReleaseTrigger($pdo) === 'paid') {
                ShopWalletService::releasePendingToAvailable($pdo, $shopId, $net, $orderId);
            }
        }

        ShopReferralService::onOrderPaid($pdo, $orderId);
    }

    /** Move pending earnings to available when order is collected (default policy). */
    public static function releaseOnOrderComplete(PDO $pdo, int $orderId): void
    {
        if (self::earningsReleaseTrigger($pdo) !== 'collected') {
            return;
        }

        $stmt = $pdo->prepare(
            "SELECT shop_id, net_amount FROM shop_order_earnings WHERE order_id = ? AND status = 'pending'"
        );
        $stmt->execute([$orderId]);
        foreach ($stmt->fetchAll() as $row) {
            ShopWalletService::releasePendingToAvailable(
                $pdo,
                (int) $row['shop_id'],
                round((float) $row['net_amount'], 2),
                $orderId
            );
        }

        ShopReferralService::onOrderCollected($pdo, $orderId);
    }

    /** @return list<array<string,mixed>> */
    public static function earningsForShop(PDO $pdo, int $shopId, int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $stmt = $pdo->prepare(
            'SELECT e.*, o.status AS order_status, o.created_at AS order_created_at
             FROM shop_order_earnings e
             INNER JOIN orders o ON o.id = e.order_id
             WHERE e.shop_id = ?
             ORDER BY e.created_at DESC LIMIT ' . $limit
        );
        $stmt->execute([$shopId]);

        return array_map(static fn (array $r): array => [
            'id'                => (int) $r['id'],
            'order_id'          => (int) $r['order_id'],
            'gross_amount'      => round((float) $r['gross_amount'], 2),
            'commission_rate'   => round((float) $r['commission_rate'], 2),
            'commission_amount' => round((float) $r['commission_amount'], 2),
            'net_amount'        => round((float) $r['net_amount'], 2),
            'status'            => $r['status'],
            'order_status'      => $r['order_status'],
            'created_at'        => $r['created_at'],
            'released_at'       => $r['released_at'],
        ], $stmt->fetchAll());
    }
}
