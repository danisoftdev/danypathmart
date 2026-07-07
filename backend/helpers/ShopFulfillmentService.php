<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

/** Per-shop fulfillment for marketplace orders (seller delivers; DPM does not ship shop goods). */
final class ShopFulfillmentService
{
    public const SHOP_STATUSES = ['preparing', 'out_for_delivery', 'delivered'];

    /** @param array<int,array<string,mixed>> $lines ShippingService quote lines */
    public static function createForOrder(PDO $pdo, int $orderId, array $lines, string $shopFulfillmentMode = 'delivery'): void
    {
        $mode = $shopFulfillmentMode === 'shop_pickup' ? 'shop_pickup' : 'delivery';
        $byShop = [];
        foreach ($lines as $line) {
            $shopId = isset($line['product']['shop_id']) && $line['product']['shop_id'] !== null
                ? (int) $line['product']['shop_id']
                : 0;
            if ($shopId <= 0) {
                continue;
            }
            $amount = round((float) $line['unit_price'] * (int) $line['quantity'], 2);
            $byShop[$shopId] = ($byShop[$shopId] ?? 0.0) + $amount;
        }

        if ($byShop === []) {
            return;
        }

        try {
            $insertFull = $pdo->prepare(
                'INSERT INTO shop_order_fulfillments (order_id, shop_id, status, subtotal, fulfillment_mode)
                 VALUES (?, ?, \'awaiting_payment\', ?, ?)'
            );
            $insertBasic = null;
        } catch (\Throwable) {
            $insertFull = null;
            $insertBasic = $pdo->prepare(
                'INSERT INTO shop_order_fulfillments (order_id, shop_id, status, subtotal)
                 VALUES (?, ?, \'awaiting_payment\', ?)'
            );
        }
        $track = $pdo->prepare(
            'INSERT INTO shop_fulfillment_tracking (fulfillment_id, status, note, updated_by) VALUES (?, ?, ?, NULL)'
        );

        foreach ($byShop as $shopId => $subtotal) {
            if ($insertFull !== null) {
                try {
                    $insertFull->execute([$orderId, $shopId, round($subtotal, 2), $mode]);
                } catch (\Throwable) {
                    $insertBasic ??= $pdo->prepare(
                        'INSERT INTO shop_order_fulfillments (order_id, shop_id, status, subtotal)
                         VALUES (?, ?, \'awaiting_payment\', ?)'
                    );
                    $insertBasic->execute([$orderId, $shopId, round($subtotal, 2)]);
                }
            } else {
                $insertBasic->execute([$orderId, $shopId, round($subtotal, 2)]);
            }
            $fulfillmentId = (int) $pdo->lastInsertId();
            $pickupNote = $mode === 'shop_pickup'
                ? 'Order placed — customer will collect at your shop after payment.'
                : 'Order placed — awaiting in-app payment before seller ships.';
            $track->execute([
                $fulfillmentId,
                'awaiting_payment',
                $pickupNote,
            ]);
        }
    }

    public static function markPaidForOrder(PDO $pdo, int $orderId): void
    {
        try {
            $stmt = $pdo->prepare(
                "SELECT id, shop_id, fulfillment_mode FROM shop_order_fulfillments
                 WHERE order_id = ? AND status = 'awaiting_payment'"
            );
        } catch (\Throwable) {
            $stmt = $pdo->prepare(
                "SELECT id, shop_id FROM shop_order_fulfillments
                 WHERE order_id = ? AND status = 'awaiting_payment'"
            );
        }
        $stmt->execute([$orderId]);
        $rows = $stmt->fetchAll();
        if ($rows === []) {
            return;
        }

        $upd = $pdo->prepare(
            "UPDATE shop_order_fulfillments SET status = 'paid', updated_at = NOW() WHERE id = ?"
        );
        $track = $pdo->prepare(
            'INSERT INTO shop_fulfillment_tracking (fulfillment_id, status, note, updated_by) VALUES (?, ?, ?, NULL)'
        );

        foreach ($rows as $row) {
            $fid = (int) $row['id'];
            $upd->execute([$fid]);
            $fulfillmentMode = (string) ($row['fulfillment_mode'] ?? 'delivery');
            $paidNote = $fulfillmentMode === 'shop_pickup'
                ? 'Payment confirmed — customer will collect at your shop.'
                : 'Payment confirmed — seller will arrange delivery. Delivery fee is paid directly to the seller.';
            $track->execute([
                $fid,
                'paid',
                $paidNote,
            ]);

            self::notifyShopMembers(
                $pdo,
                (int) $row['shop_id'],
                $orderId,
                $fid,
                $fulfillmentMode === 'shop_pickup'
                    ? 'New paid order — customer will pick up at your shop.'
                    : 'New paid order — arrange delivery to the customer address on file.'
            );
        }
    }

    public static function markCancelledForOrder(PDO $pdo, int $orderId, ?int $updatedBy = null): void
    {
        $stmt = $pdo->prepare('SELECT id FROM shop_order_fulfillments WHERE order_id = ?');
        $stmt->execute([$orderId]);
        $track = $pdo->prepare(
            'INSERT INTO shop_fulfillment_tracking (fulfillment_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
        );
        foreach ($stmt->fetchAll() as $row) {
            $fid = (int) $row['id'];
            $pdo->prepare(
                "UPDATE shop_order_fulfillments SET status = 'cancelled', updated_at = NOW() WHERE id = ?"
            )->execute([$fid]);
            $track->execute([$fid, 'cancelled', 'Order cancelled.', $updatedBy]);
        }
    }

    /** @return list<array<string,mixed>> */
    public static function listForCustomerOrder(PDO $pdo, int $orderId): array
    {
        $stmt = $pdo->prepare(
            "SELECT f.*, s.name AS shop_name, s.slug AS shop_slug,
                    s.street_address, s.city AS shop_city, s.region AS shop_region,
                    s.latitude AS shop_latitude, s.longitude AS shop_longitude,
                    s.allows_shop_pickup
             FROM shop_order_fulfillments f
             INNER JOIN shops s ON s.id = f.shop_id
             WHERE f.order_id = ?
             ORDER BY f.id ASC"
        );
        $stmt->execute([$orderId]);
        $rows = $stmt->fetchAll();
        if ($rows === []) {
            return [];
        }

        $trackStmt = $pdo->prepare(
            'SELECT status, note, created_at FROM shop_fulfillment_tracking
             WHERE fulfillment_id = ? ORDER BY id ASC'
        );

        $out = [];
        foreach ($rows as $row) {
            $fid = (int) $row['id'];
            $trackStmt->execute([$fid]);
            $out[] = [
                'id'                => $fid,
                'order_id'          => (int) $row['order_id'],
                'shop_id'           => (int) $row['shop_id'],
                'shop_name'         => (string) $row['shop_name'],
                'shop_slug'         => $row['shop_slug'],
                'status'            => (string) $row['status'],
                'fulfillment_mode'  => (string) ($row['fulfillment_mode'] ?? 'delivery'),
                'subtotal'          => round((float) $row['subtotal'], 2),
                'updated_at'        => $row['updated_at'],
                'shop_location'     => LocationHelper::publicLocationFields([
                    'street_address'     => $row['street_address'] ?? null,
                    'city'               => $row['shop_city'] ?? null,
                    'region'             => $row['shop_region'] ?? null,
                    'latitude'           => $row['shop_latitude'] ?? null,
                    'longitude'          => $row['shop_longitude'] ?? null,
                    'allows_shop_pickup' => $row['allows_shop_pickup'] ?? 0,
                ]),
                'tracking'          => array_map(static fn (array $t): array => [
                    'status'     => (string) $t['status'],
                    'note'       => $t['note'],
                    'created_at' => (string) $t['created_at'],
                ], $trackStmt->fetchAll()),
            ];
        }

        return $out;
    }

    /** @return list<array<string,mixed>> */
    public static function listForShop(PDO $pdo, int $shopId, int $limit = 100): array
    {
        $limit = max(1, min($limit, 200));
        $stmt = $pdo->prepare(
            "SELECT f.*, o.payment_status, o.created_at AS order_created_at,
                    o.status AS order_status, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                    a.street, a.landmark, a.city, a.region, a.phone AS address_phone, a.recipient_name AS address_recipient
             FROM shop_order_fulfillments f
             INNER JOIN orders o ON o.id = f.order_id
             INNER JOIN users u ON u.id = o.user_id
             LEFT JOIN addresses a ON a.id = o.address_id
             WHERE f.shop_id = ?
             ORDER BY f.updated_at DESC
             LIMIT {$limit}"
        );
        $stmt->execute([$shopId]);

        return array_map(static fn (array $r): array => self::mapListRow($r), $stmt->fetchAll());
    }

    /** @return array<string,mixed> */
    public static function detailForShop(PDO $pdo, int $shopId, int $fulfillmentId): array
    {
        $stmt = $pdo->prepare(
            "SELECT f.*, o.payment_status, o.created_at AS order_created_at, o.status AS order_status, o.notes AS order_notes,
                    u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
                    a.street, a.landmark, a.city, a.region, a.phone AS address_phone, a.recipient_name AS address_recipient
             FROM shop_order_fulfillments f
             INNER JOIN orders o ON o.id = f.order_id
             INNER JOIN users u ON u.id = o.user_id
             LEFT JOIN addresses a ON a.id = o.address_id
             WHERE f.id = ? AND f.shop_id = ?
             LIMIT 1"
        );
        $stmt->execute([$fulfillmentId, $shopId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new RuntimeException('Fulfillment not found.');
        }

        $items = $pdo->prepare(
            'SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, p.name, p.slug, p.images
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND p.shop_id = ?
             ORDER BY oi.id ASC'
        );
        $items->execute([(int) $row['order_id'], $shopId]);

        $tracking = $pdo->prepare(
            'SELECT status, note, created_at FROM shop_fulfillment_tracking
             WHERE fulfillment_id = ? ORDER BY id ASC'
        );
        $tracking->execute([(int) $row['id']]);

        $detail = self::mapListRow($row);
        $detail['items'] = array_map(static function (array $i): array {
            $images = json_decode((string) ($i['images'] ?? ''), true);

            return [
                'id'         => (int) $i['id'],
                'product_id' => (int) $i['product_id'],
                'name'       => (string) $i['name'],
                'slug'       => $i['slug'],
                'image'      => is_array($images) && isset($images[0]) ? $images[0] : null,
                'quantity'   => (int) $i['quantity'],
                'unit_price' => round((float) $i['unit_price'], 2),
                'line_total' => round((float) $i['unit_price'] * (int) $i['quantity'], 2),
            ];
        }, $items->fetchAll());
        $detail['tracking'] = array_map(static fn (array $t): array => [
            'status'     => (string) $t['status'],
            'note'       => $t['note'],
            'created_at' => (string) $t['created_at'],
        ], $tracking->fetchAll());

        return $detail;
    }

    public static function updateStatus(PDO $pdo, int $shopId, int $fulfillmentId, string $status, int $userId, ?string $note = null): void
    {
        if (!in_array($status, self::SHOP_STATUSES, true)) {
            throw new RuntimeException('Invalid fulfillment status.');
        }

        $stmt = $pdo->prepare('SELECT * FROM shop_order_fulfillments WHERE id = ? AND shop_id = ? LIMIT 1');
        $stmt->execute([$fulfillmentId, $shopId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new RuntimeException('Fulfillment not found.');
        }
        if (($row['status'] ?? '') === 'cancelled') {
            throw new RuntimeException('This order was cancelled.');
        }
        if (($row['status'] ?? '') === 'awaiting_payment') {
            throw new RuntimeException('Payment is not confirmed yet.');
        }

        $pdo->prepare(
            'UPDATE shop_order_fulfillments SET status = ?, updated_at = NOW() WHERE id = ?'
        )->execute([$status, $fulfillmentId]);

        $defaultNote = match ($status) {
            'preparing'         => 'Seller is preparing your items.',
            'out_for_delivery'  => 'Seller is on the way — delivery fee is between you and the seller.',
            'delivered'         => 'Seller marked this order as delivered.',
            default             => null,
        };

        $pdo->prepare(
            'INSERT INTO shop_fulfillment_tracking (fulfillment_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
        )->execute([
            $fulfillmentId,
            $status,
            $note !== null && trim($note) !== '' ? trim($note) : $defaultNote,
            $userId,
        ]);

        $orderId = (int) $row['order_id'];
        $orderUser = $pdo->prepare('SELECT user_id FROM orders WHERE id = ?');
        $orderUser->execute([$orderId]);
        $customerId = (int) $orderUser->fetchColumn();

        if ($customerId > 0) {
            NotificationService::notifyUser(
                $pdo,
                $customerId,
                'Shop order update — #' . $orderId,
                $defaultNote ?? 'Your marketplace order status was updated.',
                '/dashboard/orders/' . $orderId,
                'order_update'
            );
        }
    }

    /** @param array<int,array<string,mixed>> $lines */
    public static function cartHasShopItems(array $lines): bool
    {
        foreach ($lines as $line) {
            if (!empty($line['product']['shop_id'])) {
                return true;
            }
        }

        return false;
    }

    /** @param array<int,array<string,mixed>> $lines */
    public static function cartHasDpmItems(array $lines): bool
    {
        foreach ($lines as $line) {
            if (empty($line['product']['shop_id'])) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string,mixed> $row */
    private static function mapListRow(array $row): array
    {
        $addressParts = array_filter([
            $row['address_recipient'] ?? null,
            $row['street'] ?? null,
            $row['landmark'] ?? null,
            $row['city'] ?? null,
            $row['region'] ?? null,
        ], static fn ($v) => $v !== null && trim((string) $v) !== '');

        return [
            'id'               => (int) $row['id'],
            'order_id'         => (int) $row['order_id'],
            'shop_id'          => (int) $row['shop_id'],
            'status'           => (string) $row['status'],
            'fulfillment_mode' => (string) ($row['fulfillment_mode'] ?? 'delivery'),
            'subtotal'         => round((float) $row['subtotal'], 2),
            'payment_status'   => (string) ($row['payment_status'] ?? ''),
            'order_status'     => (string) ($row['order_status'] ?? ''),
            'order_created_at' => $row['order_created_at'] ?? null,
            'customer_name'    => $row['customer_name'] ?? null,
            'customer_email'   => $row['customer_email'] ?? null,
            'customer_phone'   => $row['customer_phone'] ?? null,
            'delivery_address' => $addressParts !== [] ? implode(', ', $addressParts) : null,
            'address_phone'    => $row['address_phone'] ?? null,
            'updated_at'       => $row['updated_at'] ?? null,
        ];
    }

    public static function notifyAwaitingPayment(PDO $pdo, int $shopId, int $orderId): void
    {
        $stmt = $pdo->prepare(
            'SELECT id FROM shop_order_fulfillments WHERE order_id = ? AND shop_id = ? LIMIT 1'
        );
        $stmt->execute([$orderId, $shopId]);
        $fid = (int) ($stmt->fetchColumn() ?: 0);
        if ($fid <= 0) {
            return;
        }

        self::notifyShopMembers(
            $pdo,
            $shopId,
            $orderId,
            $fid,
            'New order awaiting payment — confirm when you receive MoMo or cash.'
        );
    }

    private static function notifyShopMembers(PDO $pdo, int $shopId, int $orderId, int $fulfillmentId, string $body): void
    {
        $members = $pdo->prepare(
            'SELECT u.id FROM shop_members sm INNER JOIN users u ON u.id = sm.user_id WHERE sm.shop_id = ?'
        );
        $members->execute([$shopId]);
        foreach ($members->fetchAll() as $m) {
            NotificationService::notifyUser(
                $pdo,
                (int) $m['id'],
                'New shop order #' . $orderId,
                $body,
                '/seller/orders?f=' . $fulfillmentId,
                'shop_order'
            );
        }
    }
}
