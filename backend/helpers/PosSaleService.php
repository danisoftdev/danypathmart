<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

final class PosSaleService
{
    /**
     * @param array<int,array{product_id:int,quantity:int}> $items
     * @param array<int,array{method:string,amount:float,reference?:?string,momo_number?:?string}> $payments
     * @return array<string,mixed>
     */
    public static function complete(
        PDO $pdo,
        int $shiftId,
        int $cashierUserId,
        array $items,
        array $payments,
        float $discountAmount = 0.0,
        ?string $customerName = null,
        ?string $customerPhone = null,
        ?int $customerUserId = null,
        ?string $supervisorPin = null,
        ?float $cashTendered = null
    ): array {
        $shift = PosShiftService::assertOpenShift($pdo, $shiftId);
        $settings = PosSettingsService::load($pdo);

        $quote = PosProductService::quote($pdo, $items, $discountAmount);
        if ($quote['errors'] !== []) {
            throw new RuntimeException('Some items are unavailable or out of stock.');
        }
        if ($quote['lines'] === []) {
            throw new RuntimeException('Cart is empty.');
        }

        self::validateDiscount($pdo, $quote['subtotal'], $quote['discount_amount'], $supervisorPin, $settings);

        $total = $quote['total'];
        $normalized = self::normalizePayments($payments, $total, (int) $shift['register_id'], $pdo, $cashTendered);
        $changeGiven = $normalized['change'];
        $cashTenderedStored = $normalized['cash_tendered'];

        $orderUserId = $customerUserId !== null && $customerUserId > 0
            ? $customerUserId
            : $cashierUserId;

        $pdo->beginTransaction();
        try {
            $orderStmt = $pdo->prepare(
                'INSERT INTO orders
                    (user_id, address_id, status, subtotal, intl_shipping_cost, local_delivery_cost,
                     local_delivery_percent, total, discount_amount, discount_label,
                     payment_status, payment_method, payment_ref, notes,
                     sales_channel, pos_shift_id, pos_register_id, pos_location_id,
                     pos_cashier_user_id, pos_discount_amount, pos_customer_name, pos_customer_phone,
                     pos_change_given, pos_cash_tendered, order_type)
                 VALUES (?, NULL, ?, ?, 0, 0, 0, ?, ?, ?, \'paid\', \'pod\', ?, ?, \'pos\', ?, ?, ?, ?, ?, ?, ?, ?, ?, \'retail\')'
            );
            $trackingRef = null;
            $orderStmt->execute([
                $orderUserId,
                'collected',
                $quote['subtotal'],
                $total,
                $quote['discount_amount'] > 0 ? $quote['discount_amount'] : null,
                $quote['discount_amount'] > 0 ? 'POS discount' : null,
                $trackingRef,
                self::buildNotes($customerName, $customerPhone),
                $shiftId,
                (int) $shift['register_id'],
                (int) $shift['location_id'],
                $cashierUserId,
                $quote['discount_amount'],
                self::nullable($customerName),
                self::nullable($customerPhone),
                $changeGiven,
                $cashTenderedStored,
            ]);
            $orderId = (int) $pdo->lastInsertId();
            $trackingRef = 'POS-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
            $pdo->prepare('UPDATE orders SET payment_ref = ? WHERE id = ?')->execute([$trackingRef, $orderId]);

            self::insertOrderItems($pdo, $orderId, $quote['lines']);
            self::insertPayments($pdo, $orderId, $normalized['payments'], (int) $shift['register_id']);

            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'collected', ?, ?)"
            )->execute([
                $orderId,
                'In-store POS sale — collected at register.',
                $cashierUserId,
            ]);

            InventoryService::commitOrderInventory($pdo, $orderId);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $sale = self::find($pdo, $orderId);

        return $sale ?? [];
    }

    /**
     * Create a pending POS order and return Paystack session metadata.
     *
     * @param array<int,array{product_id:int,quantity:int}> $items
     * @return array<string,mixed>
     */
    public static function initPaystack(
        PDO $pdo,
        int $shiftId,
        int $cashierUserId,
        array $items,
        float $discountAmount,
        ?string $customerName,
        ?string $customerPhone,
        ?string $customerEmail,
        ?string $supervisorPin = null
    ): array {
        $shift = PosShiftService::assertOpenShift($pdo, $shiftId);
        $settings = PosSettingsService::load($pdo);

        $quote = PosProductService::quote($pdo, $items, $discountAmount);
        if ($quote['errors'] !== [] || $quote['lines'] === []) {
            throw new RuntimeException('Cart is invalid or empty.');
        }
        self::validateDiscount($pdo, $quote['subtotal'], $quote['discount_amount'], $supervisorPin, $settings);

        $total = $quote['total'];
        if ($total <= 0) {
            throw new RuntimeException('Nothing to charge.');
        }

        $pdo->beginTransaction();
        try {
            $orderStmt = $pdo->prepare(
                'INSERT INTO orders
                    (user_id, address_id, status, subtotal, intl_shipping_cost, local_delivery_cost,
                     local_delivery_percent, total, discount_amount, discount_label,
                     payment_status, payment_method, payment_ref, notes,
                     sales_channel, pos_shift_id, pos_register_id, pos_location_id,
                     pos_cashier_user_id, pos_discount_amount, pos_customer_name, pos_customer_phone, order_type)
                 VALUES (?, NULL, ?, ?, 0, 0, 0, ?, ?, ?, \'pending\', \'paystack\', NULL, ?, \'pos\', ?, ?, ?, ?, ?, ?, ?, \'retail\')'
            );
            $orderStmt->execute([
                $cashierUserId,
                'pending_payment',
                $quote['subtotal'],
                $total,
                $quote['discount_amount'] > 0 ? $quote['discount_amount'] : null,
                $quote['discount_amount'] > 0 ? 'POS discount' : null,
                self::buildNotes($customerName, $customerPhone),
                $shiftId,
                (int) $shift['register_id'],
                (int) $shift['location_id'],
                $cashierUserId,
                $quote['discount_amount'],
                self::nullable($customerName),
                self::nullable($customerPhone),
            ]);
            $orderId = (int) $pdo->lastInsertId();
            self::insertOrderItems($pdo, $orderId, $quote['lines']);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $email = $customerEmail !== null && trim($customerEmail) !== ''
            ? trim($customerEmail)
            : 'pos@danypathmart.store';

        $session = PosPaystackService::initialize($pdo, $orderId, $email, $total);

        return [
            'order_id' => $orderId,
            'total'    => $total,
            'paystack' => $session,
        ];
    }

    public static function completePaystack(PDO $pdo, int $orderId, string $reference, int $cashierUserId): array
    {
        $stmt = $pdo->prepare(
            "SELECT * FROM orders WHERE id = ? AND sales_channel = 'pos' AND payment_status = 'pending'"
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            throw new RuntimeException('Pending POS sale not found.');
        }

        PosPaystackService::verifyAndMarkPaid($pdo, $orderId, $reference);

        $pdo->prepare(
            'INSERT INTO pos_order_payments (order_id, method, amount, reference, momo_number)
             VALUES (?, \'paystack\', ?, ?, NULL)'
        )->execute([$orderId, round((float) $order['total'], 2), $reference]);

        $pdo->prepare(
            "UPDATE orders SET status = 'collected', payment_status = 'paid', payment_method = 'paystack',
                    payment_ref = ?, pos_cashier_user_id = ?
             WHERE id = ?"
        )->execute([$reference, $cashierUserId, $orderId]);

        $pdo->prepare(
            "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'collected', ?, ?)"
        )->execute([
            $orderId,
            'POS Paystack payment confirmed.',
            $cashierUserId,
        ]);

        InventoryService::commitOrderInventory($pdo, $orderId);

        $sale = self::find($pdo, $orderId);

        return $sale ?? [];
    }

    public static function void(PDO $pdo, int $orderId, int $userId, string $reason, bool $asSupervisor, ?string $supervisorPin = null): void
    {
        $stmt = $pdo->prepare(
            "SELECT * FROM orders WHERE id = ? AND sales_channel = 'pos' AND pos_voided_at IS NULL"
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            throw new RuntimeException('POS sale not found.');
        }

        $settings = PosSettingsService::load($pdo);
        $created = strtotime((string) $order['created_at']);
        $window = ($settings['pos_void_window_minutes'] ?? 30) * 60;
        if (!$asSupervisor) {
            if ($supervisorPin !== null && PosSettingsService::verifySupervisorPin($pdo, $supervisorPin)) {
                $asSupervisor = true;
            } elseif ($created !== false && (time() - $created) > $window) {
                throw new RuntimeException('Void window expired — supervisor PIN required.');
            }
        }

        $pdo->beginTransaction();
        try {
            InventoryService::restoreOrderInventory($pdo, $orderId);
            $pdo->prepare(
                "UPDATE orders SET status = 'cancelled', payment_status = 'refunded', pos_voided_at = NOW(),
                        notes = CONCAT(COALESCE(notes, ''), '\nVoid: ', ?)
                 WHERE id = ?"
            )->execute([trim($reason), $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([$orderId, 'cancelled', 'POS void: ' . trim($reason), $userId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** @return array<string,mixed>|null */
    public static function find(PDO $pdo, int $orderId): ?array
    {
        $stmt = $pdo->prepare(
            "SELECT o.*, u.name AS cashier_name
             FROM orders o
             LEFT JOIN users u ON u.id = o.pos_cashier_user_id
             WHERE o.id = ? AND o.sales_channel = 'pos'"
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            return null;
        }

        $items = $pdo->prepare(
            'SELECT oi.*, p.name, p.slug
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?'
        );
        $items->execute([$orderId]);

        $payments = $pdo->prepare('SELECT * FROM pos_order_payments WHERE order_id = ? ORDER BY id ASC');
        $payments->execute([$orderId]);

        $reg = isset($order['pos_register_id']) ? PosRegisterService::find($pdo, (int) $order['pos_register_id']) : null;
        $loc = isset($order['pos_location_id']) ? PosLocationService::find($pdo, (int) $order['pos_location_id']) : null;

        return [
            'id'                => (int) $order['id'],
            'tracking_ref'      => $order['payment_ref'],
            'subtotal'          => round((float) $order['subtotal'], 2),
            'discount_amount'   => round((float) ($order['pos_discount_amount'] ?? 0), 2),
            'total'             => round((float) $order['total'], 2),
            'change_given'      => round((float) ($order['pos_change_given'] ?? 0), 2),
            'cash_tendered'     => $order['pos_cash_tendered'] !== null ? round((float) $order['pos_cash_tendered'], 2) : null,
            'status'            => (string) $order['status'],
            'payment_status'    => (string) $order['payment_status'],
            'customer_name'     => $order['pos_customer_name'],
            'customer_phone'    => $order['pos_customer_phone'],
            'cashier_name'      => $order['cashier_name'],
            'register'          => $reg,
            'location'          => $loc,
            'shift_id'          => isset($order['pos_shift_id']) ? (int) $order['pos_shift_id'] : null,
            'voided'            => $order['pos_voided_at'] !== null,
            'created_at'        => $order['created_at'],
            'items'             => array_map(static fn (array $i): array => [
                'product_id' => (int) $i['product_id'],
                'name'       => (string) $i['name'],
                'quantity'   => (int) $i['quantity'],
                'unit_price' => round((float) $i['unit_price'], 2),
                'line_total' => round((float) $i['unit_price'] * (int) $i['quantity'], 2),
            ], $items->fetchAll()),
            'payments'          => array_map(static fn (array $p): array => [
                'method'      => (string) $p['method'],
                'amount'      => round((float) $p['amount'], 2),
                'reference'   => $p['reference'],
                'momo_number' => $p['momo_number'],
            ], $payments->fetchAll()),
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function listForShift(PDO $pdo, int $shiftId, bool $includeVoided = false): array
    {
        $sql = "SELECT id FROM orders
                WHERE pos_shift_id = ? AND sales_channel = 'pos'";
        if (!$includeVoided) {
            $sql .= ' AND pos_voided_at IS NULL';
        }
        $sql .= ' ORDER BY id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$shiftId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $sale = self::find($pdo, (int) $row['id']);
            if ($sale !== null) {
                $out[] = $sale;
            }
        }

        return $out;
    }

    /** @param list<array<string,mixed>> $lines */
    private static function insertOrderItems(PDO $pdo, int $orderId, array $lines): void
    {
        $itemStmt = $pdo->prepare(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, unit_cbm_cost, is_preorder)
             VALUES (?, ?, ?, ?, ?, 0, 0)'
        );
        foreach ($lines as $line) {
            $p = $line['product'];
            $itemStmt->execute([
                $orderId,
                (int) $p['id'],
                (int) $line['quantity'],
                $line['unit_price'],
                (float) ($p['cost_price'] ?? 0),
            ]);
        }
    }

    /** @param array<int,array<string,mixed>> $payments */
    private static function insertPayments(PDO $pdo, int $orderId, array $payments, int $registerId): void
    {
        $payStmt = $pdo->prepare(
            'INSERT INTO pos_order_payments (order_id, method, amount, reference, momo_number)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($payments as $pay) {
            $method = (string) $pay['method'];
            $momoNum = self::nullable($pay['momo_number'] ?? null);
            if ($method === 'momo' && $momoNum === null) {
                $momoNum = PosRegisterService::resolveMomo($pdo, $registerId);
            }
            $payStmt->execute([
                $orderId,
                $method,
                round((float) $pay['amount'], 2),
                self::nullable($pay['reference'] ?? null),
                $momoNum,
            ]);
        }
    }

    /** @param array<string,mixed> $settings */
    private static function validateDiscount(
        PDO $pdo,
        float $subtotal,
        float $discountAmount,
        ?string $supervisorPin,
        array $settings
    ): void {
        if ($discountAmount <= 0 || $subtotal <= 0) {
            return;
        }

        $pct = ($discountAmount / $subtotal) * 100;
        $maxPct = (float) ($settings['pos_max_cashier_discount_percent'] ?? 10);
        if ($pct <= $maxPct + 0.01) {
            return;
        }

        if (PosSettingsService::verifySupervisorPin($pdo, $supervisorPin)) {
            return;
        }

        throw new RuntimeException(
            sprintf('Discount exceeds cashier limit (%.0f%%). Supervisor PIN required.', $maxPct)
        );
    }

    /**
     * @param array<int,array<string,mixed>> $payments
     * @return array{payments:array<int,array<string,mixed>>,change:float,cash_tendered:?float}
     */
    private static function normalizePayments(
        array $payments,
        float $total,
        int $registerId,
        PDO $pdo,
        ?float $cashTendered
    ): array {
        if ($payments === []) {
            throw new RuntimeException('At least one payment is required.');
        }

        $normalized = [];
        $sum = 0.0;
        $change = 0.0;
        $tenderedStored = null;

        foreach ($payments as $idx => $pay) {
            $method = self::normalizeMethod((string) ($pay['method'] ?? ''));
            $amount = round((float) ($pay['amount'] ?? 0), 2);
            if ($amount <= 0) {
                throw new RuntimeException('Invalid payment amount.');
            }
            if ($method === 'momo' && empty($pay['reference'])) {
                throw new RuntimeException('MoMo reference is required.');
            }
            if ($method === 'paystack') {
                throw new RuntimeException('Use Paystack checkout for card/mobile payments.');
            }
            if ($method === 'momo' && empty($pay['momo_number'])) {
                $payments[$idx]['momo_number'] = PosRegisterService::resolveMomo($pdo, $registerId);
            }
            $normalized[] = [
                'method'      => $method,
                'amount'      => $amount,
                'reference'   => $pay['reference'] ?? null,
                'momo_number' => $payments[$idx]['momo_number'] ?? null,
            ];
            $sum += $amount;
        }

        $isSingleCash = count($normalized) === 1 && $normalized[0]['method'] === 'cash';
        if ($isSingleCash && $cashTendered !== null && $cashTendered > $total + 0.009) {
            $tenderedStored = round($cashTendered, 2);
            $change = round($cashTendered - $total, 2);
            $normalized[0]['amount'] = round($total, 2);
            $sum = round($total, 2);
        }

        if (abs($sum - $total) > 0.02) {
            throw new RuntimeException('Payment total must match sale total.');
        }

        return [
            'payments'      => $normalized,
            'change'        => $change,
            'cash_tendered' => $tenderedStored,
        ];
    }

    private static function normalizeMethod(string $method): string
    {
        $method = strtolower(trim($method));
        if (!in_array($method, ['cash', 'momo', 'paystack', 'card'], true)) {
            throw new RuntimeException('Invalid payment method.');
        }

        return $method;
    }

    private static function buildNotes(?string $name, ?string $phone): ?string
    {
        $parts = array_filter([
            $name !== null && trim($name) !== '' ? 'Customer: ' . trim($name) : null,
            $phone !== null && trim($phone) !== '' ? 'Phone: ' . trim($phone) : null,
        ]);

        return $parts === [] ? null : implode(' · ', $parts);
    }

    private static function nullable(?string $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim($v);

        return $s === '' ? null : $s;
    }
}
