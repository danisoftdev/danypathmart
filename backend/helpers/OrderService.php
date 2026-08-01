<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/**
 * Order lifecycle transitions shared by the Paystack webhook and the
 * development confirmation endpoint.
 */
final class OrderService
{
    /** @param array<string,mixed> $order */
    public static function walletPaid(array $order): float
    {
        return round((float) ($order['wallet_paid'] ?? 0), 2);
    }

    /** @param array<string,mixed> $order */
    public static function amountDue(array $order): float
    {
        return max(0.0, round((float) $order['total'] - self::walletPaid($order), 2));
    }

    /**
     * Apply wallet credit toward an unpaid order (full or partial).
     *
     * @return array{wallet_paid:float,amount_due:float,paid:bool,balance:float}
     */
    public static function payWithWallet(PDO $pdo, int $orderId, int $userId, ?float $requestedAmount = null): array
    {
        PaymentSettings::assertMethodEnabled($pdo, 'wallet');

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (($order['payment_status'] ?? '') === 'paid') {
            Response::error('This order has already been paid.', 409, ['code' => 'already_paid']);
        }
        if (($order['payment_method'] ?? '') === 'pod') {
            Response::error('Pay-on-delivery orders cannot be paid with wallet.', 422);
        }
        if (($order['payment_method'] ?? '') === 'bank_transfer' && !empty($order['bank_transfer_ref'])) {
            Response::error('Bank transfer is pending confirmation.', 422);
        }

        $due = self::amountDue($order);
        if ($due <= 0) {
            Response::error('Nothing left to pay on this order.', 422);
        }

        $balance = WalletService::getBalance($pdo, $userId);
        if ($balance <= 0) {
            Response::error('Your wallet balance is zero.', 422, ['code' => 'insufficient_wallet']);
        }

        $amount = $requestedAmount !== null
            ? round($requestedAmount, 2)
            : min($balance, $due);
        if ($amount <= 0) {
            Response::error('Enter a valid wallet amount.', 422);
        }
        if ($amount > $due) {
            Response::error('Wallet amount cannot exceed ' . number_format($due, 2) . ' GHS due.', 422);
        }
        if ($amount > $balance) {
            Response::error('Insufficient wallet balance.', 422, ['code' => 'insufficient_wallet']);
        }

        $pdo->beginTransaction();
        try {
            WalletService::debit(
                $pdo,
                $userId,
                $amount,
                $orderId,
                'Checkout payment for order #' . $orderId,
                true
            );

            $newWalletPaid = round(self::walletPaid($order) + $amount, 2);
            $newDue = max(0.0, round((float) $order['total'] - $newWalletPaid, 2));
            $method = $newDue > 0 ? 'wallet_paystack' : 'wallet';

            $pdo->prepare(
                'UPDATE orders SET wallet_paid = ?, payment_method = ? WHERE id = ?'
            )->execute([$newWalletPaid, $method, $orderId]);

            if ($newDue <= 0) {
                self::finalizePaidOrder(
                    $pdo,
                    $orderId,
                    (int) $order['user_id'],
                    'Payment completed from your wallet.',
                    'WALLET-' . $orderId
                );
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $newBalance = WalletService::getBalance($pdo, $userId);

        return [
            'wallet_paid' => $newWalletPaid,
            'amount_due'  => $newDue,
            'paid'        => $newDue <= 0,
            'balance'     => $newBalance,
        ];
    }

    public static function submitBankTransfer(PDO $pdo, int $orderId, int $userId, string $reference): void
    {
        PaymentSettings::assertMethodEnabled($pdo, 'bank_transfer');

        $reference = trim($reference);
        if ($reference === '') {
            Response::error('Please enter your bank transfer reference.', 422);
        }
        if (strlen($reference) > 120) {
            Response::error('Reference is too long.', 422);
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (($order['payment_status'] ?? '') === 'paid') {
            Response::error('This order has already been paid.', 409);
        }
        if (($order['payment_method'] ?? '') !== 'bank_transfer') {
            Response::error('This order is not set up for bank transfer.', 422);
        }

        $pdo->prepare(
            'UPDATE orders SET bank_transfer_ref = ?, bank_transfer_submitted_at = NOW() WHERE id = ?'
        )->execute([$reference, $orderId]);

        $pdo->prepare(
            'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
        )->execute([
            $orderId,
            $order['status'] ?? 'placed',
            'Bank transfer reference submitted: ' . $reference,
            $userId,
        ]);

        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        NotificationService::notifyUser(
            $pdo,
            $userId,
            "Transfer received — Order {$trackingRef}",
            "We received your bank transfer reference ({$reference}). We will confirm payment and prepare your order soon.",
            '/dashboard/orders/' . $orderId,
            'order_update'
        );

        NotificationService::notifyAdmins(
            $pdo,
            "Bank transfer submitted — {$trackingRef}",
            "Customer submitted transfer reference: {$reference}\nOrder total: GHS "
            . number_format((float) $order['total'], 2),
            '/admin/orders/' . $orderId,
            'admin_order'
        );
    }

    public static function confirmBankTransfer(PDO $pdo, int $orderId, int $adminId): void
    {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (($order['payment_method'] ?? '') !== 'bank_transfer') {
            Response::error('This order was not paid by bank transfer.', 422);
        }
        if (($order['payment_status'] ?? '') === 'paid') {
            Response::error('Order is already marked paid.', 422);
        }
        if (empty($order['bank_transfer_ref'])) {
            Response::error('Customer has not submitted a transfer reference yet.', 422);
        }

        $ref = 'BANK-' . (string) $order['bank_transfer_ref'];
        $pdo->beginTransaction();
        try {
            self::finalizePaidOrder(
                $pdo,
                $orderId,
                (int) $order['user_id'],
                'Bank transfer confirmed.',
                $ref
            );
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** Record pay-on-delivery selection after order is created. */
    public static function setupPayOnDelivery(PDO $pdo, int $orderId, int $userId): void
    {
        PaymentSettings::assertMethodEnabled($pdo, 'pod');

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }

        $pdo->prepare("UPDATE orders SET payment_method = 'pod' WHERE id = ?")->execute([$orderId]);
        $pdo->prepare(
            'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
        )->execute([
            $orderId,
            $order['status'] ?? 'placed',
            'Pay on delivery — pay the driver in cash (GHS) when your order arrives.',
            $userId,
        ]);

        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        NotificationService::notifyUser(
            $pdo,
            $userId,
            "Order {$trackingRef} — Pay on delivery",
            "Your order is placed. Pay the delivery driver in Ghana Cedis when your items arrive. Order total: "
            . number_format((float) $order['total'], 2) . ' GHS.',
            '/dashboard/orders/' . $orderId,
            'order_update'
        );
    }

    /**
     * Mark an order as paid (idempotent), record the payment, advance tracking,
     * and email the customer a branded confirmation.
     *
     * @param array<string,mixed> $payload  Raw gateway payload to persist.
     */
    public static function markPaid(
        PDO $pdo,
        int $orderId,
        string $reference,
        ?string $channel = null,
        array $payload = []
    ): bool {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            return false;
        }
        if ($order['payment_status'] === 'paid') {
            return true;
        }

        $due = self::amountDue($order);
        if ($due <= 0 && self::walletPaid($order) >= (float) $order['total']) {
            self::finalizePaidOrder($pdo, $orderId, (int) $order['user_id'], 'Payment confirmed.', $reference);
            return true;
        }

        $pdo->beginTransaction();
        try {
            $method = self::walletPaid($order) > 0 ? 'wallet_paystack' : 'paystack';
            $pdo->prepare(
                "UPDATE orders
                 SET payment_status = 'paid', status = 'pending', payment_ref = ?, payment_method = ?
                 WHERE id = ?"
            )->execute([$reference, $method, $orderId]);

            $upd = $pdo->prepare(
                "UPDATE payments SET status = 'success', channel = ?, payload = ?
                 WHERE paystack_ref = ?"
            );
            $upd->execute([$channel, json_encode($payload), $reference]);
            if ($upd->rowCount() === 0) {
                $pdo->prepare(
                    "INSERT INTO payments (order_id, paystack_ref, amount, channel, status, payload)
                     VALUES (?, ?, ?, ?, 'success', ?)"
                )->execute([$orderId, $reference, $due, $channel, json_encode($payload)]);
            }

            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'payment_confirmed', ?)"
            )->execute([
                $orderId,
                self::walletPaid($order) > 0
                    ? 'Paystack payment confirmed (wallet + card/mobile).'
                    : 'Payment confirmed via Paystack.',
            ]);

            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'pending', ?)"
            )->execute([$orderId, 'Paid — awaiting preparation. You may cancel until we start processing.']);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        try {
            self::sendConfirmation($pdo, (int) $order['id'], (int) $order['user_id']);
            NotificationService::notifyOrderStatus($pdo, $orderId, 'pending', 'Your payment was received. We will prepare your order soon.');
            NotificationService::notifyOrderPaid($pdo, $orderId, $order, $channel);
            ReferralService::onOrderPaid($pdo, $orderId);
            if (($order['payment_collector'] ?? 'dpm') !== 'shop') {
                MarketplaceSplitService::recordOnPayment($pdo, $orderId);
            }
            ShopFulfillmentService::markPaidForOrder($pdo, $orderId);
            InventoryService::commitOrderInventory($pdo, $orderId);
        } catch (Throwable $e) {
            // Payment is already committed — never fail the client/webhook because of emails/push.
            error_log('OrderService::markPaid side effects failed for order #' . $orderId . ': ' . $e->getMessage());
        }
        return true;
    }

    private static function finalizePaidOrder(
        PDO $pdo,
        int $orderId,
        int $userId,
        string $paymentNote,
        string $reference
    ): void {
        $pdo->prepare(
            "UPDATE orders
             SET payment_status = 'paid', status = 'pending', payment_ref = ?
             WHERE id = ?"
        )->execute([$reference, $orderId]);

        $pdo->prepare(
            "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'payment_confirmed', ?)"
        )->execute([$orderId, $paymentNote]);

        $pdo->prepare(
            "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'pending', ?)"
        )->execute([$orderId, 'Paid — awaiting preparation. You may cancel until we start processing.']);

        self::sendConfirmation($pdo, $orderId, $userId);
        NotificationService::notifyOrderStatus($pdo, $orderId, 'pending', 'Your payment was received. We will prepare your order soon.');
        $paidOrder = $pdo->prepare('SELECT total, payment_collector FROM orders WHERE id = ?');
        $paidOrder->execute([$orderId]);
        $orderRow = $paidOrder->fetch();
        if ($orderRow !== false) {
            NotificationService::notifyOrderPaid($pdo, $orderId, $orderRow);
        }

        ReferralService::onOrderPaid($pdo, $orderId);
        if (($orderRow['payment_collector'] ?? 'dpm') !== 'shop') {
            MarketplaceSplitService::recordOnPayment($pdo, $orderId);
        }
        ShopFulfillmentService::markPaidForOrder($pdo, $orderId);
        InventoryService::commitOrderInventory($pdo, $orderId);
    }

    /** @param array<string,mixed> $order */
    public static function canCustomerCancel(array $order): bool
    {
        if (($order['status'] ?? '') === 'cancelled') {
            return false;
        }

        return in_array($order['status'] ?? '', ['placed', 'pending'], true);
    }

    public static function cancelByCustomer(PDO $pdo, int $orderId, int $userId, ?string $reason): void
    {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (!self::canCustomerCancel($order)) {
            Response::error('This order can no longer be cancelled. Contact support if you need help.', 422, [
                'code' => 'cancel_not_allowed',
            ]);
        }

        $note = self::formatCancelNote($reason, 'customer');

        $pdo->beginTransaction();
        try {
            self::applyCancellation($pdo, $orderId, 'customer', $note, $userId);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        NotificationService::notifyOrderStatus($pdo, $orderId, 'cancelled', $note);
    }

    public static function cancelByAdmin(PDO $pdo, int $orderId, int $adminId, string $reason): void
    {
        $reason = trim($reason);
        if ($reason === '') {
            Response::error('A cancellation reason is required so the customer knows why.', 422);
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (($order['status'] ?? '') === 'cancelled') {
            Response::error('Order is already cancelled.', 422);
        }

        $pdo->beginTransaction();
        try {
            self::applyCancellation($pdo, $orderId, 'admin', $reason, $adminId);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        NotificationService::notifyOrderStatus($pdo, $orderId, 'cancelled', $reason);
    }

    public static function reviveByAdmin(PDO $pdo, int $orderId, int $adminId, string $reason): void
    {
        $reason = trim($reason);
        if ($reason === '') {
            Response::error('A reason is required when reviving a cancelled order.', 422);
        }

        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }
        if (($order['status'] ?? '') !== 'cancelled') {
            Response::error('Only cancelled orders can be revived.', 422);
        }
        if (($order['cancelled_by'] ?? '') !== 'customer') {
            Response::error('Only orders cancelled by the customer can be revived here.', 422, [
                'code' => 'revive_not_allowed',
            ]);
        }

        $pdo->beginTransaction();
        try {
            self::reserveStockForOrder($pdo, $orderId);
            $newStatus = ($order['payment_status'] ?? '') === 'paid' ? 'pending' : 'placed';
            $pdo->prepare(
                "UPDATE orders SET status = ?, cancelled_by = NULL, cancel_reason = NULL WHERE id = ?"
            )->execute([$newStatus, $orderId]);
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([$orderId, $newStatus, 'Order revived by admin: ' . $reason, $adminId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        NotificationService::notifyOrderStatus($pdo, $orderId, $newStatus, 'Your order was restored: ' . $reason);
    }

    private static function applyCancellation(
        PDO $pdo,
        int $orderId,
        string $cancelledBy,
        string $reason,
        int $updatedBy
    ): void {
        $stmt = $pdo->prepare('SELECT user_id, wallet_paid, payment_status FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();

        InventoryService::restoreOrderInventory($pdo, $orderId);

        if ($order !== false) {
            $walletPaid = round((float) ($order['wallet_paid'] ?? 0), 2);
            if ($walletPaid > 0 && ($order['payment_status'] ?? '') !== 'cancelled') {
                WalletService::credit(
                    $pdo,
                    (int) $order['user_id'],
                    $walletPaid,
                    'refund',
                    $orderId,
                    'Order cancelled — wallet payment returned.',
                    null
                );
            }
        }

        $pdo->prepare(
            "UPDATE orders SET status = 'cancelled', cancelled_by = ?, cancel_reason = ?, wallet_paid = 0 WHERE id = ?"
        )->execute([$cancelledBy, $reason !== '' ? $reason : null, $orderId]);
        $pdo->prepare(
            'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
        )->execute([$orderId, 'cancelled', $reason !== '' ? $reason : 'Order cancelled.', $updatedBy]);

        ShopFulfillmentService::markCancelledForOrder($pdo, $orderId, $updatedBy);
    }

    private static function formatCancelNote(?string $reason, string $by): string
    {
        $reason = trim((string) $reason);
        if ($reason !== '') {
            return $reason;
        }

        return $by === 'customer' ? 'Cancelled by customer.' : 'Cancelled by admin.';
    }

    public static function restoreStockForOrder(PDO $pdo, int $orderId): void
    {
        $items = $pdo->prepare(
            'SELECT product_id, quantity, is_preorder FROM order_items WHERE order_id = ?'
        );
        $items->execute([$orderId]);
        foreach ($items->fetchAll() as $row) {
            if ((int) $row['is_preorder'] === 1 || $row['product_id'] === null) {
                continue;
            }
            $pdo->prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?')
                ->execute([(int) $row['quantity'], (int) $row['product_id']]);
        }
    }

    public static function reserveStockForOrder(PDO $pdo, int $orderId): void
    {
        $items = $pdo->prepare(
            'SELECT oi.product_id, oi.quantity, oi.is_preorder, p.stock_qty, p.name
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?'
        );
        $items->execute([$orderId]);
        foreach ($items->fetchAll() as $row) {
            if ((int) $row['is_preorder'] === 1 || $row['product_id'] === null) {
                continue;
            }
            $stock = (int) ($row['stock_qty'] ?? 0);
            $need = (int) $row['quantity'];
            if ($stock < $need) {
                Response::error(
                    'Cannot revive — insufficient stock for ' . ($row['name'] ?? 'an item') . '.',
                    422,
                    ['code' => 'insufficient_stock']
                );
            }
            $pdo->prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?')
                ->execute([$need, (int) $row['product_id']]);
        }
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function walletRefundsForOrder(PDO $pdo, int $orderId): array
    {
        try {
            $stmt = $pdo->prepare(
                "SELECT id, amount, note, created_at, type
                 FROM wallet_transactions
                 WHERE order_id = ? AND amount > 0 AND type IN ('refund', 'admin_credit')
                 ORDER BY created_at ASC"
            );
            $stmt->execute([$orderId]);
        } catch (\Throwable) {
            return [];
        }

        return array_map(static fn (array $r): array => [
            'id'         => (int) $r['id'],
            'amount'     => round((float) $r['amount'], 2),
            'note'       => $r['note'],
            'type'       => $r['type'],
            'created_at' => $r['created_at'],
        ], $stmt->fetchAll());
    }

    private static function sendConfirmation(PDO $pdo, int $orderId, int $userId): void
    {
        $orderStmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch();
        if ($order === false) {
            return;
        }

        $userStmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            return;
        }

        $itemsStmt = $pdo->prepare(
            'SELECT oi.quantity, oi.unit_price, oi.is_preorder, oi.estimated_arrival, p.name, p.images
             FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? ORDER BY oi.id ASC'
        );
        $itemsStmt->execute([$orderId]);
        $items = $itemsStmt->fetchAll();

        Mailer::orderConfirmation((string) $user['email'], (string) $user['name'], [
            'order' => $order,
            'items' => $items,
        ]);
    }

    /** @param array<string,mixed> $order */
    public static function pickupStationFromOrder(array $order): ?array
    {
        if (empty($order['pickup_station_snapshot'])) {
            return null;
        }
        $decoded = json_decode((string) $order['pickup_station_snapshot'], true);

        return is_array($decoded) ? $decoded : null;
    }

    public static function isPickupOrder(array $order): bool
    {
        return !empty($order['pickup_station_id']) || self::pickupStationFromOrder($order) !== null;
    }
}
