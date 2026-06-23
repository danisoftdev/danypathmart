<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class PosReportService
{
    /** @return array<string,mixed> */
    public static function shiftReport(PDO $pdo, int $shiftId, string $type = 'x'): array
    {
        $shift = PosShiftService::find($pdo, $shiftId);
        if ($shift === null) {
            throw new \RuntimeException('Shift not found.');
        }

        $type = strtolower($type) === 'z' ? 'z' : 'x';
        if ($type === 'z' && !in_array($shift['status'], ['pending_approval', 'approved', 'rejected'], true)) {
            throw new \RuntimeException('Z-report is available after the shift is closed.');
        }

        $settings = PosSettingsService::load($pdo);
        $sales = PosSaleService::listForShift($pdo, $shiftId, true);
        $voided = self::voidedSalesForShift($pdo, $shiftId);

        $gross = 0.0;
        foreach ($sales as $s) {
            if (empty($s['voided'])) {
                $gross += (float) $s['total'];
            }
        }

        return [
            'type'          => $type,
            'generated_at'  => date('c'),
            'company_name'  => $settings['company_name'] ?? 'DanyPathMart',
            'shift'         => $shift,
            'totals'        => $shift['totals'] ?? [
                'cash'     => PosShiftService::paymentTotalForShift($pdo, $shiftId, 'cash'),
                'momo'     => PosShiftService::paymentTotalForShift($pdo, $shiftId, 'momo'),
                'paystack' => PosShiftService::paymentTotalForShift($pdo, $shiftId, 'paystack'),
                'card'     => PosShiftService::paymentTotalForShift($pdo, $shiftId, 'card'),
                'sales'    => PosShiftService::salesCountForShift($pdo, $shiftId),
            ],
            'gross_sales'   => round($gross, 2),
            'voided_count'  => count($voided),
            'voided_total'  => round(array_sum(array_map(static fn (array $s): float => (float) $s['total'], $voided)), 2),
            'expected_cash' => PosShiftService::expectedCash($pdo, $shift),
            'sales'         => $sales,
            'voided_sales'  => $voided,
        ];
    }

    /** @return array<string,mixed> */
    public static function summary(PDO $pdo, ?string $from = null, ?string $to = null): array
    {
        $fromDt = $from !== null && $from !== '' ? $from . ' 00:00:00' : date('Y-m-d 00:00:00', strtotime('-30 days'));
        $toDt = $to !== null && $to !== '' ? $to . ' 23:59:59' : date('Y-m-d 23:59:59');

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS sale_count,
                    COALESCE(SUM(total), 0) AS gross_total,
                    COALESCE(SUM(pos_discount_amount), 0) AS discount_total
             FROM orders
             WHERE sales_channel = 'pos'
               AND pos_voided_at IS NULL
               AND created_at BETWEEN ? AND ?"
        );
        $stmt->execute([$fromDt, $toDt]);
        $row = $stmt->fetch() ?: [];

        $payStmt = $pdo->prepare(
            "SELECT p.method, COALESCE(SUM(p.amount), 0) AS total
             FROM pos_order_payments p
             INNER JOIN orders o ON o.id = p.order_id
             WHERE o.sales_channel = 'pos'
               AND o.pos_voided_at IS NULL
               AND o.created_at BETWEEN ? AND ?
             GROUP BY p.method"
        );
        $payStmt->execute([$fromDt, $toDt]);
        $byMethod = [];
        foreach ($payStmt->fetchAll() as $p) {
            $byMethod[(string) $p['method']] = round((float) $p['total'], 2);
        }

        $shiftStmt = $pdo->prepare(
            "SELECT status, COUNT(*) AS cnt FROM pos_shifts
             WHERE opened_at BETWEEN ? AND ?
             GROUP BY status"
        );
        $shiftStmt->execute([$fromDt, $toDt]);
        $shiftsByStatus = [];
        foreach ($shiftStmt->fetchAll() as $s) {
            $shiftsByStatus[(string) $s['status']] = (int) $s['cnt'];
        }

        return [
            'from'            => $fromDt,
            'to'              => $toDt,
            'sale_count'      => (int) ($row['sale_count'] ?? 0),
            'gross_total'     => round((float) ($row['gross_total'] ?? 0), 2),
            'discount_total'  => round((float) ($row['discount_total'] ?? 0), 2),
            'payments'        => $byMethod,
            'shifts_by_status'=> $shiftsByStatus,
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function voidedSalesForShift(PDO $pdo, int $shiftId): array
    {
        $stmt = $pdo->prepare(
            "SELECT id FROM orders
             WHERE pos_shift_id = ? AND sales_channel = 'pos' AND pos_voided_at IS NOT NULL
             ORDER BY id DESC"
        );
        $stmt->execute([$shiftId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $sale = PosSaleService::find($pdo, (int) $row['id']);
            if ($sale !== null) {
                $out[] = $sale;
            }
        }

        return $out;
    }
}
