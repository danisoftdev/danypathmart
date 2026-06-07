<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Inbound hub receive + station handoff queue (Phase M7). */
final class HubLogisticsService
{
    public static function assertEnabled(PDO $pdo): void
    {
        if (!PlatformFeatures::load($pdo)['driver_module_enabled']) {
            throw new \InvalidArgumentException('Driver logistics module is not enabled.');
        }
    }

    /** Orders paid and awaiting hub intake (pickup flow). */
    public static function hubReceiveQueue(PDO $pdo): array
    {
        self::assertEnabled($pdo);

        $stmt = $pdo->query(
            "SELECT o.id, o.status, o.payment_status, o.total, o.created_at,
                    o.pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                    u.name AS customer_name
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             LEFT JOIN pickup_stations ps ON ps.id = o.pickup_station_id
             WHERE o.pickup_station_id IS NOT NULL
               AND o.payment_status = 'paid'
               AND o.status IN ('pending', 'processing')
             ORDER BY o.created_at ASC
             LIMIT 200"
        );

        return array_map(static fn (array $r): array => self::formatOrderRow($r), $stmt->fetchAll());
    }

    /** Orders at hub ready to assign to a delivery run. */
    public static function hubReadyForRunQueue(PDO $pdo): array
    {
        self::assertEnabled($pdo);

        $stmt = $pdo->query(
            "SELECT o.id, o.status, o.payment_status, o.total, o.created_at,
                    o.pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                    u.name AS customer_name
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             LEFT JOIN pickup_stations ps ON ps.id = o.pickup_station_id
             WHERE o.pickup_station_id IS NOT NULL
               AND o.status = 'received_at_hub'
               AND o.id NOT IN (SELECT order_id FROM delivery_run_stops WHERE status = 'pending')
             ORDER BY ps.name ASC, o.created_at ASC
             LIMIT 200"
        );

        return array_map(static fn (array $r): array => self::formatOrderRow($r), $stmt->fetchAll());
    }

    /** Orders dropped at station — station staff can mark ready for pickup (feeds M8). */
    public static function stationReceiveQueue(PDO $pdo, ?int $stationId = null): array
    {
        self::assertEnabled($pdo);

        $sql = "SELECT o.id, o.status, o.payment_status, o.total, o.created_at,
                       o.pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                       u.name AS customer_name
                FROM orders o
                INNER JOIN users u ON u.id = o.user_id
                LEFT JOIN pickup_stations ps ON ps.id = o.pickup_station_id
                WHERE o.status = 'sent_to_station'";
        $params = [];
        if ($stationId !== null && $stationId > 0) {
            $sql .= ' AND o.pickup_station_id = ?';
            $params[] = $stationId;
        }
        $sql .= ' ORDER BY o.created_at ASC LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => self::formatOrderRow($r), $stmt->fetchAll());
    }

    /**
     * @param list<int> $orderIds
     * @return list<int>
     */
    public static function receiveAtHub(PDO $pdo, array $orderIds, int $adminUserId, ?string $note = null): array
    {
        self::assertEnabled($pdo);
        $received = [];

        foreach ($orderIds as $orderId) {
            $orderId = (int) $orderId;
            if ($orderId <= 0) {
                continue;
            }

            $stmt = $pdo->prepare(
                'SELECT id, status, payment_status, pickup_station_id FROM orders WHERE id = ?'
            );
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if ($order === false) {
                continue;
            }
            if ($order['pickup_station_id'] === null) {
                continue;
            }
            if (($order['payment_status'] ?? '') !== 'paid') {
                continue;
            }
            if (!in_array($order['status'] ?? '', ['pending', 'processing'], true)) {
                continue;
            }

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['received_at_hub', $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([
                $orderId,
                'received_at_hub',
                $note ?? 'Received at DanyPathMart hub',
                $adminUserId,
            ]);
            NotificationService::notifyOrderStatus($pdo, $orderId, 'received_at_hub', $note);
            $received[] = $orderId;
        }

        return $received;
    }

    /**
     * @param list<int> $orderIds
     * @return list<int>
     */
    public static function markReadyForPickup(PDO $pdo, array $orderIds, int $adminUserId, ?string $note = null): array
    {
        self::assertEnabled($pdo);
        if (PlatformFeatures::load($pdo)['station_repack_module_enabled']) {
            throw new \InvalidArgumentException(
                'Station repack module is on — use the station portal to repack and release orders.'
            );
        }
        $updated = [];

        foreach ($orderIds as $orderId) {
            $orderId = (int) $orderId;
            if ($orderId <= 0) {
                continue;
            }

            $stmt = $pdo->prepare('SELECT id, status FROM orders WHERE id = ?');
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if ($order === false || ($order['status'] ?? '') !== 'sent_to_station') {
                continue;
            }

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['ready_for_pickup', $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([
                $orderId,
                'ready_for_pickup',
                $note ?? 'Arrived at pickup station',
                $adminUserId,
            ]);
            NotificationService::notifyOrderStatus($pdo, $orderId, 'ready_for_pickup', $note);
            $updated[] = $orderId;
        }

        return $updated;
    }

    /** @param array<string,mixed> $r */
    private static function formatOrderRow(array $r): array
    {
        return [
            'id'                => (int) $r['id'],
            'status'            => $r['status'],
            'payment_status'    => $r['payment_status'],
            'total'             => round((float) $r['total'], 2),
            'created_at'        => $r['created_at'],
            'pickup_station_id' => $r['pickup_station_id'] !== null ? (int) $r['pickup_station_id'] : null,
            'station_name'      => $r['station_name'] ?? null,
            'station_city'      => $r['station_city'] ?? null,
            'customer_name'     => $r['customer_name'] ?? null,
        ];
    }
}
