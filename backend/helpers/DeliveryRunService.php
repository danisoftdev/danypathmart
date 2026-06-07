<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Delivery runs: hub → pickup stations (Phase M7). */
final class DeliveryRunService
{
    /** @return list<array<string,mixed>> */
    public static function listRuns(PDO $pdo, ?string $status = null): array
    {
        HubLogisticsService::assertEnabled($pdo);

        $sql = 'SELECT r.*, u.name AS driver_name, u.phone AS driver_phone,
                       (SELECT COUNT(*) FROM delivery_run_stops s WHERE s.run_id = r.id) AS stop_count,
                       (SELECT COUNT(*) FROM delivery_run_stops s WHERE s.run_id = r.id AND s.status = \'delivered\') AS delivered_count
                FROM delivery_runs r
                INNER JOIN users u ON u.id = r.driver_user_id
                WHERE u.role = \'driver\'';
        $params = [];
        if ($status !== null && $status !== '' && $status !== 'all') {
            $sql .= ' AND r.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY r.created_at DESC LIMIT 100';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'formatRunSummary'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findRun(PDO $pdo, int $runId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT r.*, u.name AS driver_name, u.email AS driver_email, u.phone AS driver_phone
             FROM delivery_runs r
             INNER JOIN users u ON u.id = r.driver_user_id
             WHERE r.id = ?'
        );
        $stmt->execute([$runId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRunDetail($pdo, $row);
    }

    /**
     * @param array{driver_user_id:int,order_ids:list<int>,title?:string,hub_note?:string} $input
     */
    public static function createRun(PDO $pdo, array $input, int $createdBy): array
    {
        HubLogisticsService::assertEnabled($pdo);

        $driverId = (int) ($input['driver_user_id'] ?? 0);
        $orderIds = array_values(array_unique(array_map('intval', $input['order_ids'] ?? [])));
        if ($driverId <= 0 || $orderIds === []) {
            throw new \InvalidArgumentException('Driver and at least one order are required.');
        }

        $driver = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'driver' AND status = 'verified'");
        $driver->execute([$driverId]);
        if ($driver->fetch() === false) {
            throw new \InvalidArgumentException('Driver not found.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO delivery_runs (driver_user_id, status, title, hub_note, created_by)
                 VALUES (?, \'draft\', ?, ?, ?)'
            )->execute([
                $driverId,
                self::nullableStr($input['title'] ?? null),
                self::nullableStr($input['hub_note'] ?? null),
                $createdBy,
            ]);
            $runId = (int) $pdo->lastInsertId();
            $order = 1;

            foreach ($orderIds as $orderId) {
                if ($orderId <= 0) {
                    continue;
                }
                $oStmt = $pdo->prepare(
                    'SELECT id, status, pickup_station_id FROM orders WHERE id = ? AND pickup_station_id IS NOT NULL'
                );
                $oStmt->execute([$orderId]);
                $o = $oStmt->fetch();
                if ($o === false || ($o['status'] ?? '') !== 'received_at_hub') {
                    throw new \InvalidArgumentException("Order #{$orderId} is not at hub ready for dispatch.");
                }

                $exists = $pdo->prepare('SELECT 1 FROM delivery_run_stops WHERE order_id = ?');
                $exists->execute([$orderId]);
                if ($exists->fetch() !== false) {
                    throw new \InvalidArgumentException("Order #{$orderId} is already on a delivery run.");
                }

                $pdo->prepare(
                    'INSERT INTO delivery_run_stops (run_id, order_id, pickup_station_id, stop_order)
                     VALUES (?, ?, ?, ?)'
                )->execute([$runId, $orderId, (int) $o['pickup_station_id'], $order++]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return self::findRun($pdo, $runId) ?? [];
    }

    public static function dispatchRun(PDO $pdo, int $runId): array
    {
        $run = self::requireRun($pdo, $runId);
        if ($run['status'] !== 'draft') {
            throw new \InvalidArgumentException('Only draft runs can be dispatched.');
        }
        if (($run['stop_count'] ?? 0) < 1) {
            throw new \InvalidArgumentException('Add at least one order to the run.');
        }

        $pdo->prepare(
            "UPDATE delivery_runs SET status = 'dispatched', dispatched_at = NOW() WHERE id = ?"
        )->execute([$runId]);

        return self::findRun($pdo, $runId) ?? [];
    }

    public static function confirmStopDelivery(PDO $pdo, int $runId, int $orderId, int $driverUserId, ?string $note = null): array
    {
        $run = self::requireRun($pdo, $runId);
        if ((int) $run['driver_user_id'] !== $driverUserId) {
            throw new \InvalidArgumentException('This run is assigned to another driver.');
        }
        if ($run['status'] !== 'dispatched') {
            throw new \InvalidArgumentException('Run is not active for delivery.');
        }

        $stop = $pdo->prepare(
            'SELECT id, status FROM delivery_run_stops WHERE run_id = ? AND order_id = ?'
        );
        $stop->execute([$runId, $orderId]);
        $s = $stop->fetch();
        if ($s === false) {
            throw new \InvalidArgumentException('Stop not found on this run.');
        }
        if ($s['status'] === 'delivered') {
            throw new \InvalidArgumentException('This stop was already confirmed.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "UPDATE delivery_run_stops SET status = 'delivered', delivered_at = NOW(), delivery_note = ? WHERE id = ?"
            )->execute([$note, (int) $s['id']]);

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(['sent_to_station', $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([
                $orderId,
                'sent_to_station',
                $note ?? 'Delivered to pickup station',
                $driverUserId,
            ]);

            $pending = $pdo->prepare(
                "SELECT COUNT(*) FROM delivery_run_stops WHERE run_id = ? AND status = 'pending'"
            );
            $pending->execute([$runId]);
            if ((int) $pending->fetchColumn() === 0) {
                $pdo->prepare(
                    "UPDATE delivery_runs SET status = 'completed', completed_at = NOW() WHERE id = ?"
                )->execute([$runId]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        NotificationService::notifyOrderStatus($pdo, $orderId, 'sent_to_station', $note);

        return self::findRun($pdo, $runId) ?? [];
    }

    /** @return list<array<string,mixed>> */
    public static function driverActiveRuns(PDO $pdo, int $driverUserId): array
    {
        $stmt = $pdo->prepare(
            "SELECT r.* FROM delivery_runs r
             WHERE r.driver_user_id = ? AND r.status = 'dispatched'
             ORDER BY r.dispatched_at DESC"
        );
        $stmt->execute([$driverUserId]);

        return array_map(
            static fn (array $row): array => self::formatRunDetail($pdo, $row),
            $stmt->fetchAll()
        );
    }

    /** @param array<string,mixed> $row */
    private static function formatRunSummary(array $row): array
    {
        return [
            'id'               => (int) $row['id'],
            'driver_user_id'   => (int) $row['driver_user_id'],
            'driver_name'      => $row['driver_name'],
            'driver_phone'     => $row['driver_phone'],
            'status'           => $row['status'],
            'title'            => $row['title'],
            'hub_note'         => $row['hub_note'],
            'stop_count'       => (int) ($row['stop_count'] ?? 0),
            'delivered_count'  => (int) ($row['delivered_count'] ?? 0),
            'dispatched_at'    => $row['dispatched_at'],
            'completed_at'     => $row['completed_at'],
            'created_at'       => $row['created_at'],
        ];
    }

    /** @return array<string,mixed> */
    private static function formatRunDetail(PDO $pdo, array $row): array
    {
        $runId = (int) $row['id'];
        $summary = self::formatRunSummary($row);

        $stmt = $pdo->prepare(
            'SELECT s.*, o.total, o.status AS order_status, ps.name AS station_name, ps.city AS station_city,
                    ps.street_address, ps.landmark, ps.phone AS station_phone
             FROM delivery_run_stops s
             INNER JOIN orders o ON o.id = s.order_id
             INNER JOIN pickup_stations ps ON ps.id = s.pickup_station_id
             WHERE s.run_id = ?
             ORDER BY s.stop_order ASC'
        );
        $stmt->execute([$runId]);
        $summary['stops'] = array_map(static fn (array $s): array => [
            'id'               => (int) $s['id'],
            'order_id'         => (int) $s['order_id'],
            'pickup_station_id'=> (int) $s['pickup_station_id'],
            'stop_order'       => (int) $s['stop_order'],
            'status'           => $s['status'],
            'delivered_at'     => $s['delivered_at'],
            'delivery_note'    => $s['delivery_note'],
            'order_total'      => round((float) $s['total'], 2),
            'order_status'     => $s['order_status'],
            'station_name'     => $s['station_name'],
            'station_city'     => $s['station_city'],
            'station_address'  => trim(implode(', ', array_filter([
                $s['street_address'] ?? '',
                $s['landmark'] ?? '',
                $s['station_city'] ?? '',
            ]))),
            'station_phone'    => $s['station_phone'],
        ], $stmt->fetchAll());

        return $summary;
    }

    /** @return array<string,mixed> */
    private static function requireRun(PDO $pdo, int $runId): array
    {
        $run = self::findRun($pdo, $runId);
        if ($run === null) {
            throw new \InvalidArgumentException('Delivery run not found.');
        }

        return $run;
    }

    private static function nullableStr(mixed $v): ?string
    {
        $s = trim((string) ($v ?? ''));

        return $s === '' ? null : $s;
    }
}
