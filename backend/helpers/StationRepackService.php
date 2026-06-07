<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Station repack + customer release (Phase M8). */
final class StationRepackService
{
    public static function assertEnabled(PDO $pdo): void
    {
        $flags = PlatformFeatures::load($pdo);
        if (!$flags['station_repack_module_enabled']) {
            throw new \InvalidArgumentException('Station repack module is not enabled.');
        }
        if (!$flags['pickup_stations_enabled']) {
            throw new \InvalidArgumentException('Pickup stations must be enabled for station repack.');
        }
    }

    /** Orders dropped by driver — awaiting DPM repack. */
    public static function inboundQueue(PDO $pdo, int $stationId): array
    {
        self::assertEnabled($pdo);
        self::assertStation($pdo, $stationId);

        $stmt = $pdo->prepare(
            "SELECT o.id, o.status, o.payment_status, o.total, o.created_at,
                    o.pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                    u.name AS customer_name, u.phone AS customer_phone
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             INNER JOIN pickup_stations ps ON ps.id = o.pickup_station_id
             WHERE o.pickup_station_id = ?
               AND o.status = 'sent_to_station'
             ORDER BY o.created_at ASC
             LIMIT 200"
        );
        $stmt->execute([$stationId]);

        return array_map([self::class, 'formatOrderRow'], $stmt->fetchAll());
    }

    /** Repacked — waiting for customer collection. */
    public static function readyForCollectionQueue(PDO $pdo, int $stationId): array
    {
        self::assertEnabled($pdo);
        self::assertStation($pdo, $stationId);

        $stmt = $pdo->prepare(
            "SELECT o.id, o.status, o.payment_status, o.total, o.created_at,
                    o.pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                    u.name AS customer_name, u.phone AS customer_phone,
                    (SELECT l.bag_label FROM station_repack_logs l
                     WHERE l.order_id = o.id AND l.event_type = 'repack_completed'
                     ORDER BY l.id DESC LIMIT 1) AS bag_label
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             INNER JOIN pickup_stations ps ON ps.id = o.pickup_station_id
             WHERE o.pickup_station_id = ?
               AND o.status = 'ready_for_pickup'
             ORDER BY o.created_at ASC
             LIMIT 200"
        );
        $stmt->execute([$stationId]);

        return array_map([self::class, 'formatOrderRow'], $stmt->fetchAll());
    }

    /**
     * @param list<int> $orderIds
     * @return list<int>
     */
    public static function completeRepack(
        PDO $pdo,
        array $orderIds,
        int $stationId,
        int $staffUserId,
        ?string $bagLabel = null,
        ?string $note = null
    ): array {
        self::assertEnabled($pdo);
        $updated = [];

        foreach ($orderIds as $orderId) {
            $orderId = (int) $orderId;
            if ($orderId <= 0) {
                continue;
            }

            $stmt = $pdo->prepare(
                'SELECT id, status, pickup_station_id FROM orders WHERE id = ?'
            );
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if ($order === false) {
                continue;
            }
            if ((int) ($order['pickup_station_id'] ?? 0) !== $stationId) {
                continue;
            }
            if (($order['status'] ?? '') !== 'sent_to_station') {
                continue;
            }

            $label = self::nullableStr($bagLabel);
            $trackNote = $note ?? ($label !== null ? "Repacked — bag {$label}" : 'Repacked into DPM packaging');

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['ready_for_pickup', $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([$orderId, 'ready_for_pickup', $trackNote, $staffUserId]);

            $pdo->prepare(
                'INSERT INTO station_repack_logs (order_id, pickup_station_id, staff_user_id, event_type, bag_label, note)
                 VALUES (?, ?, ?, \'repack_completed\', ?, ?)'
            )->execute([$orderId, $stationId, $staffUserId, $label, self::nullableStr($note)]);

            NotificationService::notifyOrderStatus($pdo, $orderId, 'ready_for_pickup', $trackNote);
            $updated[] = $orderId;
        }

        return $updated;
    }

    /**
     * @param list<int> $orderIds
     * @return list<int>
     */
    public static function markCollected(
        PDO $pdo,
        array $orderIds,
        int $stationId,
        int $staffUserId,
        ?string $note = null
    ): array {
        self::assertEnabled($pdo);
        $updated = [];

        foreach ($orderIds as $orderId) {
            $orderId = (int) $orderId;
            if ($orderId <= 0) {
                continue;
            }

            $stmt = $pdo->prepare(
                'SELECT id, status, pickup_station_id FROM orders WHERE id = ?'
            );
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if ($order === false) {
                continue;
            }
            if ((int) ($order['pickup_station_id'] ?? 0) !== $stationId) {
                continue;
            }
            if (($order['status'] ?? '') !== 'ready_for_pickup') {
                continue;
            }

            $trackNote = $note ?? 'Collected at pickup station';

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['collected', $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([$orderId, 'collected', $trackNote, $staffUserId]);

            $pdo->prepare(
                'INSERT INTO station_repack_logs (order_id, pickup_station_id, staff_user_id, event_type, note)
                 VALUES (?, ?, ?, \'collected\', ?)'
            )->execute([$orderId, $stationId, $staffUserId, self::nullableStr($note)]);

            NotificationService::notifyOrderStatus($pdo, $orderId, 'collected', $trackNote);
            ShopWalletService::creditOnOrderCollected($pdo, $orderId);
            $updated[] = $orderId;
        }

        return $updated;
    }

    public static function stationSummary(PDO $pdo, int $stationId): array
    {
        self::assertStation($pdo, $stationId);

        $inbound = $pdo->prepare(
            "SELECT COUNT(*) FROM orders WHERE pickup_station_id = ? AND status = 'sent_to_station'"
        );
        $inbound->execute([$stationId]);

        $ready = $pdo->prepare(
            "SELECT COUNT(*) FROM orders WHERE pickup_station_id = ? AND status = 'ready_for_pickup'"
        );
        $ready->execute([$stationId]);

        $stmt = $pdo->prepare('SELECT id, name, slug, city, region, street_address, phone FROM pickup_stations WHERE id = ?');
        $stmt->execute([$stationId]);
        $station = $stmt->fetch();

        return [
            'station'        => $station === false ? null : [
                'id'              => (int) $station['id'],
                'name'            => $station['name'],
                'slug'            => $station['slug'],
                'city'            => $station['city'],
                'region'          => $station['region'],
                'street_address'  => $station['street_address'],
                'phone'           => $station['phone'],
            ],
            'inbound_count'  => (int) $inbound->fetchColumn(),
            'ready_count'    => (int) $ready->fetchColumn(),
        ];
    }

    private static function assertStation(PDO $pdo, int $stationId): void
    {
        if ($stationId <= 0) {
            throw new \InvalidArgumentException('Pickup station is required.');
        }
        $stmt = $pdo->prepare('SELECT id FROM pickup_stations WHERE id = ? AND is_active = 1');
        $stmt->execute([$stationId]);
        if ($stmt->fetch() === false) {
            throw new \InvalidArgumentException('Pickup station not found.');
        }
    }

    /** @param array<string,mixed> $r */
    private static function formatOrderRow(array $r): array
    {
        return [
            'id'              => (int) $r['id'],
            'status'          => $r['status'],
            'payment_status'  => $r['payment_status'],
            'total'           => round((float) $r['total'], 2),
            'created_at'      => $r['created_at'],
            'pickup_station_id' => (int) $r['pickup_station_id'],
            'station_name'    => $r['station_name'] ?? null,
            'station_city'    => $r['station_city'] ?? null,
            'customer_name'   => $r['customer_name'] ?? null,
            'customer_phone'  => $r['customer_phone'] ?? null,
            'bag_label'       => $r['bag_label'] ?? null,
        ];
    }

    private static function nullableStr(mixed $v): ?string
    {
        $s = trim((string) ($v ?? ''));

        return $s === '' ? null : $s;
    }
}
