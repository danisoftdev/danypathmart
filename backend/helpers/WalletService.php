<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/** Customer wallet balance + immutable transaction ledger. */
final class WalletService
{
    public static function getBalance(PDO $pdo, int $userId): float
    {
        $stmt = $pdo->prepare('SELECT balance FROM wallets WHERE user_id = ?');
        $stmt->execute([$userId]);
        $balance = $stmt->fetchColumn();

        return $balance === false ? 0.0 : round((float) $balance, 2);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listTransactions(PDO $pdo, int $userId, int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $stmt = $pdo->prepare(
            'SELECT id, amount, balance_after, type, order_id, note, created_at
             FROM wallet_transactions
             WHERE user_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ' . $limit
        );
        $stmt->execute([$userId]);

        return array_map(static fn (array $r): array => [
            'id'            => (int) $r['id'],
            'amount'        => round((float) $r['amount'], 2),
            'balance_after' => round((float) $r['balance_after'], 2),
            'type'          => $r['type'],
            'order_id'      => $r['order_id'] !== null ? (int) $r['order_id'] : null,
            'note'          => $r['note'],
            'created_at'    => $r['created_at'],
        ], $stmt->fetchAll());
    }

    public static function refundedTotalForOrder(PDO $pdo, int $orderId): float
    {
        $stmt = $pdo->prepare(
            "SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
             WHERE order_id = ? AND type IN ('refund', 'admin_credit') AND amount > 0"
        );
        $stmt->execute([$orderId]);

        return round((float) $stmt->fetchColumn(), 2);
    }

    public static function paidFromWalletForOrder(PDO $pdo, int $orderId): float
    {
        try {
            $stmt = $pdo->prepare('SELECT wallet_paid FROM orders WHERE id = ?');
            $stmt->execute([$orderId]);
            $v = $stmt->fetchColumn();
        } catch (\Throwable) {
            return 0.0;
        }

        return $v === false ? 0.0 : round((float) $v, 2);
    }

    /**
     * Debit a customer wallet for checkout (order payment).
     *
     * @return array{balance:float,transaction_id:int}
     */
    public static function debit(
        PDO $pdo,
        int $userId,
        float $amount,
        int $orderId,
        ?string $note,
        bool $inTransaction = false
    ): array {
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero.', 422);
        }

        if (!$inTransaction) {
            $pdo->beginTransaction();
        }
        try {
            $pdo->prepare(
                'INSERT INTO wallets (user_id, balance) VALUES (?, 0)
                 ON DUPLICATE KEY UPDATE user_id = user_id'
            )->execute([$userId]);

            $lock = $pdo->prepare('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE');
            $lock->execute([$userId]);
            $current = round((float) ($lock->fetchColumn() ?: 0), 2);
            if ($current < $amount) {
                Response::error('Insufficient wallet balance.', 422, ['code' => 'insufficient_wallet']);
            }

            $newBalance = round($current - $amount, 2);
            $pdo->prepare('UPDATE wallets SET balance = ? WHERE user_id = ?')
                ->execute([$newBalance, $userId]);

            $pdo->prepare(
                'INSERT INTO wallet_transactions (user_id, amount, balance_after, type, order_id, note, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                -$amount,
                $newBalance,
                'order_payment',
                $orderId,
                $note,
                null,
            ]);

            if (!$inTransaction) {
                $pdo->commit();
            }

            return ['balance' => $newBalance, 'transaction_id' => (int) $pdo->lastInsertId()];
        } catch (Throwable $e) {
            if (!$inTransaction) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Credit a customer wallet (refund, admin credit, etc.).
     *
     * @return array{balance:float,transaction_id:int}
     */
    public static function credit(
        PDO $pdo,
        int $userId,
        float $amount,
        string $type,
        ?int $orderId,
        ?string $note,
        ?int $createdBy
    ): array {
        if ($amount <= 0) {
            Response::error('Amount must be greater than zero.', 422);
        }

        $allowed = ['refund', 'admin_credit', 'adjustment', 'referral_credit'];
        if (!in_array($type, $allowed, true)) {
            Response::error('Invalid wallet credit type.', 422);
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO wallets (user_id, balance) VALUES (?, 0)
                 ON DUPLICATE KEY UPDATE user_id = user_id'
            )->execute([$userId]);

            $lock = $pdo->prepare('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE');
            $lock->execute([$userId]);
            $current = round((float) ($lock->fetchColumn() ?: 0), 2);
            $newBalance = round($current + $amount, 2);

            $pdo->prepare('UPDATE wallets SET balance = ? WHERE user_id = ?')
                ->execute([$newBalance, $userId]);

            $pdo->prepare(
                'INSERT INTO wallet_transactions (user_id, amount, balance_after, type, order_id, note, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $amount,
                $newBalance,
                $type,
                $orderId,
                $note,
                $createdBy,
            ]);

            $pdo->commit();

            return ['balance' => $newBalance, 'transaction_id' => (int) $pdo->lastInsertId()];
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Refund part or all of an order total to the customer's wallet.
     *
     * @return array{balance:float,transaction_id:int,credited:float}
     */
    public static function refundOrderToWallet(
        PDO $pdo,
        int $orderId,
        float $amount,
        string $reason,
        int $adminId
    ): array {
        $stmt = $pdo->prepare(
            'SELECT id, user_id, total, payment_status FROM orders WHERE id = ?'
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            Response::error('Order not found.', 404);
        }

        $userId = (int) $order['user_id'];
        $orderTotal = round((float) $order['total'], 2);
        $already = self::refundedTotalForOrder($pdo, $orderId);
        $remaining = round($orderTotal - $already, 2);

        if ($remaining <= 0) {
            Response::error('This order has already been fully refunded to the wallet.', 422);
        }

        $amount = round($amount, 2);
        if ($amount <= 0 || $amount > $remaining) {
            Response::error(
                'Refund amount must be between 0.01 and ' . number_format($remaining, 2) . ' GHS.',
                422
            );
        }

        $note = trim($reason);
        if ($note === '') {
            Response::error('Please provide a reason for this wallet credit.', 422);
        }

        $userCheck = $pdo->prepare("SELECT role FROM users WHERE id = ? AND role = 'customer'");
        $userCheck->execute([$userId]);
        if ($userCheck->fetch() === false) {
            Response::error('Wallet credits apply to customer orders only.', 422);
        }

        $result = self::credit($pdo, $userId, $amount, 'refund', $orderId, $note, $adminId);

        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        NotificationService::notifyUser(
            $pdo,
            $userId,
            "Wallet credit — Order {$trackingRef}",
            number_format($amount, 2) . " GHS was added to your wallet.\nReason: {$note}",
            '/dashboard/orders/' . $orderId,
            'order_update'
        );

        return $result + ['credited' => $amount];
    }
}
