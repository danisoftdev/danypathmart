<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

final class PosShiftService
{
    /** @return array<string,mixed>|null */
    public static function currentForRegister(PDO $pdo, int $registerId): ?array
    {
        $stmt = $pdo->prepare(
            "SELECT s.*, r.name AS register_name, l.name AS location_name,
                    u.name AS opened_by_name
             FROM pos_shifts s
             INNER JOIN pos_registers r ON r.id = s.register_id
             INNER JOIN pos_locations l ON l.id = s.location_id
             INNER JOIN users u ON u.id = s.opened_by
             WHERE s.register_id = ? AND s.status = 'open'
             ORDER BY s.id DESC LIMIT 1"
        );
        $stmt->execute([$registerId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($pdo, $row);
    }

    /** @return array<string,mixed>|null */
    public static function find(PDO $pdo, int $shiftId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT s.*, r.name AS register_name, l.name AS location_name,
                    u.name AS opened_by_name
             FROM pos_shifts s
             INNER JOIN pos_registers r ON r.id = s.register_id
             INNER JOIN pos_locations l ON l.id = s.location_id
             INNER JOIN users u ON u.id = s.opened_by
             WHERE s.id = ?'
        );
        $stmt->execute([$shiftId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($pdo, $row, true);
    }

    public static function open(PDO $pdo, int $registerId, int $userId, float $openingFloat): array
    {
        $reg = PosRegisterService::find($pdo, $registerId);
        if ($reg === null || !$reg['is_active']) {
            throw new RuntimeException('Register not found or inactive.');
        }
        if (self::currentForRegister($pdo, $registerId) !== null) {
            throw new RuntimeException('This register already has an open shift.');
        }

        $pdo->prepare(
            'INSERT INTO pos_shifts (register_id, location_id, opened_by, opening_float, status)
             VALUES (?, ?, ?, ?, \'open\')'
        )->execute([
            $registerId,
            (int) $reg['location_id'],
            $userId,
            round(max(0, $openingFloat), 2),
        ]);

        return self::find($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    public static function close(PDO $pdo, int $shiftId, int $userId, float $countedCash, ?string $varianceNote): array
    {
        $shift = self::find($pdo, $shiftId);
        if ($shift === null) {
            throw new RuntimeException('Shift not found.');
        }
        if ($shift['status'] !== 'open') {
            throw new RuntimeException('Shift is not open.');
        }

        $expected = self::expectedCash($pdo, $shift);
        $counted = round(max(0, $countedCash), 2);
        $variance = round($counted - $expected, 2);
        if (abs($variance) > 0.009 && trim((string) $varianceNote) === '') {
            throw new RuntimeException('Please explain the cash variance.');
        }

        $pdo->prepare(
            'UPDATE pos_shifts SET
                status = \'pending_approval\',
                closed_by = ?,
                expected_cash = ?,
                counted_cash = ?,
                cash_variance = ?,
                variance_note = ?,
                closed_at = NOW()
             WHERE id = ?'
        )->execute([
            $userId,
            $expected,
            $counted,
            $variance,
            $varianceNote !== null && trim($varianceNote) !== '' ? trim($varianceNote) : null,
            $shiftId,
        ]);

        return self::find($pdo, $shiftId) ?? [];
    }

    public static function approve(PDO $pdo, int $shiftId, int $supervisorId): array
    {
        $shift = self::find($pdo, $shiftId);
        if ($shift === null) {
            throw new RuntimeException('Shift not found.');
        }
        if ($shift['status'] !== 'pending_approval') {
            throw new RuntimeException('Shift is not awaiting approval.');
        }

        $pdo->prepare(
            "UPDATE pos_shifts SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?"
        )->execute([$supervisorId, $shiftId]);

        return self::find($pdo, $shiftId) ?? [];
    }

    public static function reject(PDO $pdo, int $shiftId, int $supervisorId, string $note): array
    {
        $shift = self::find($pdo, $shiftId);
        if ($shift === null) {
            throw new RuntimeException('Shift not found.');
        }
        if ($shift['status'] !== 'pending_approval') {
            throw new RuntimeException('Shift is not awaiting approval.');
        }

        $pdo->prepare(
            "UPDATE pos_shifts SET status = 'rejected', approved_by = ?, rejection_note = ?, approved_at = NOW()
             WHERE id = ?"
        )->execute([$supervisorId, trim($note), $shiftId]);

        return self::find($pdo, $shiftId) ?? [];
    }

    /** @return list<array<string,mixed>> */
    public static function listPending(PDO $pdo): array
    {
        $stmt = $pdo->query(
            "SELECT s.*, r.name AS register_name, l.name AS location_name, u.name AS opened_by_name
             FROM pos_shifts s
             INNER JOIN pos_registers r ON r.id = s.register_id
             INNER JOIN pos_locations l ON l.id = s.location_id
             INNER JOIN users u ON u.id = s.opened_by
             WHERE s.status = 'pending_approval'
             ORDER BY s.closed_at ASC"
        );

        return array_map(static fn (array $r): array => self::format($pdo, $r, true), $stmt->fetchAll());
    }

    /** @param array<string,mixed> $shift */
    public static function expectedCash(PDO $pdo, array $shift): float
    {
        $opening = round((float) ($shift['opening_float'] ?? 0), 2);
        $cashSales = self::paymentTotalForShift($pdo, (int) $shift['id'], 'cash');
        $cashRefunds = self::refundTotalForShift($pdo, (int) $shift['id'], 'cash');

        return round($opening + $cashSales - $cashRefunds, 2);
    }

    public static function paymentTotalForShift(PDO $pdo, int $shiftId, ?string $method = null): float
    {
        $sql = 'SELECT COALESCE(SUM(p.amount), 0)
                FROM pos_order_payments p
                INNER JOIN orders o ON o.id = p.order_id
                WHERE o.pos_shift_id = ? AND o.sales_channel = \'pos\' AND o.pos_voided_at IS NULL';
        $params = [$shiftId];
        if ($method !== null) {
            $sql .= ' AND p.method = ?';
            $params[] = $method;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return round((float) $stmt->fetchColumn(), 2);
    }

    private static function refundTotalForShift(PDO $pdo, int $shiftId, string $method): float
    {
        return 0.0;
    }

    /** @param array<string,mixed> $row */
    private static function format(PDO $pdo, array $row, bool $withTotals = false): array
    {
        $shift = [
            'id'              => (int) $row['id'],
            'register_id'     => (int) $row['register_id'],
            'register_name'   => $row['register_name'] ?? null,
            'location_id'     => (int) $row['location_id'],
            'location_name'   => $row['location_name'] ?? null,
            'opened_by'       => (int) $row['opened_by'],
            'opened_by_name'  => $row['opened_by_name'] ?? null,
            'closed_by'       => isset($row['closed_by']) && $row['closed_by'] !== null ? (int) $row['closed_by'] : null,
            'approved_by'     => isset($row['approved_by']) && $row['approved_by'] !== null ? (int) $row['approved_by'] : null,
            'status'          => (string) $row['status'],
            'opening_float'   => round((float) ($row['opening_float'] ?? 0), 2),
            'expected_cash'   => $row['expected_cash'] !== null ? round((float) $row['expected_cash'], 2) : null,
            'counted_cash'    => $row['counted_cash'] !== null ? round((float) $row['counted_cash'], 2) : null,
            'cash_variance'   => $row['cash_variance'] !== null ? round((float) $row['cash_variance'], 2) : null,
            'variance_note'   => $row['variance_note'] ?? null,
            'rejection_note'  => $row['rejection_note'] ?? null,
            'opened_at'       => $row['opened_at'] ?? null,
            'closed_at'       => $row['closed_at'] ?? null,
            'approved_at'     => $row['approved_at'] ?? null,
        ];

        if ($withTotals) {
            $shift['totals'] = [
                'cash'     => self::paymentTotalForShift($pdo, (int) $shift['id'], 'cash'),
                'momo'     => self::paymentTotalForShift($pdo, (int) $shift['id'], 'momo'),
                'paystack' => self::paymentTotalForShift($pdo, (int) $shift['id'], 'paystack'),
                'card'     => self::paymentTotalForShift($pdo, (int) $shift['id'], 'card'),
                'sales'    => self::salesCountForShift($pdo, (int) $shift['id']),
            ];
        }

        return $shift;
    }

    public static function salesCountForShift(PDO $pdo, int $shiftId): int
    {
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM orders WHERE pos_shift_id = ? AND sales_channel = 'pos' AND pos_voided_at IS NULL"
        );
        $stmt->execute([$shiftId]);

        return (int) $stmt->fetchColumn();
    }

    public static function assertOpenShift(PDO $pdo, int $shiftId): array
    {
        $shift = self::find($pdo, $shiftId);
        if ($shift === null) {
            throw new RuntimeException('Shift not found.');
        }
        if ($shift['status'] !== 'open') {
            throw new RuntimeException('Register shift is not open.');
        }

        return $shift;
    }
}
