<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Shop seller wallet ledger (Phase M4). */
final class ShopWalletService
{
    /** @return array<string,mixed> */
    public static function getWallet(PDO $pdo, int $shopId): array
    {
        $stmt = $pdo->prepare('SELECT * FROM shop_wallets WHERE shop_id = ?');
        $stmt->execute([$shopId]);
        $row = $stmt->fetch();
        if ($row === false) {
            $pdo->prepare('INSERT INTO shop_wallets (shop_id) VALUES (?)')->execute([$shopId]);
            return [
                'shop_id'           => $shopId,
                'balance_pending'   => 0.0,
                'balance_available' => 0.0,
                'balance_reserved'  => 0.0,
            ];
        }

        return [
            'shop_id'           => $shopId,
            'balance_pending'   => round((float) $row['balance_pending'], 2),
            'balance_available' => round((float) $row['balance_available'], 2),
            'balance_reserved'  => round((float) $row['balance_reserved'], 2),
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function listTransactions(PDO $pdo, int $shopId, int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $stmt = $pdo->prepare(
            'SELECT id, amount, balance_bucket, balance_after, type, order_id, withdrawal_id, note, created_at
             FROM shop_wallet_transactions WHERE shop_id = ?
             ORDER BY created_at DESC, id DESC LIMIT ' . $limit
        );
        $stmt->execute([$shopId]);

        return array_map(static fn (array $r): array => [
            'id'             => (int) $r['id'],
            'amount'         => round((float) $r['amount'], 2),
            'balance_bucket' => $r['balance_bucket'],
            'balance_after'  => round((float) $r['balance_after'], 2),
            'type'           => $r['type'],
            'order_id'       => $r['order_id'] !== null ? (int) $r['order_id'] : null,
            'withdrawal_id'  => $r['withdrawal_id'] !== null ? (int) $r['withdrawal_id'] : null,
            'note'           => $r['note'],
            'created_at'     => $r['created_at'],
        ], $stmt->fetchAll());
    }

    public static function creditPending(
        PDO $pdo,
        int $shopId,
        float $amount,
        int $orderId,
        string $note = 'Order earnings (pending)'
    ): void {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $shopId, 'pending', $amount, 'order_earning_pending', $orderId, null, $note);
    }

    public static function creditAvailable(
        PDO $pdo,
        int $shopId,
        float $amount,
        ?int $orderId,
        string $note = 'Referral bonus'
    ): void {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $shopId, 'available', $amount, 'referral_bonus', $orderId, null, $note);
    }

    public static function creditReferralPending(PDO $pdo, int $shopId, float $amount, int $earningId, string $note): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $shopId, 'pending', $amount, 'subscription_referral_pending', null, null, $note);
    }

    public static function releaseReferralPending(PDO $pdo, int $shopId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $shopId, 'pending', -$amount, 'subscription_referral_release', null, null, 'Released after shop approval');
            self::adjust($pdo, $shopId, 'available', $amount, 'subscription_referral_available', null, null, 'Referral commission available');
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function reverseReferralPending(PDO $pdo, int $shopId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $shopId, 'pending', -$amount, 'subscription_referral_reversed', null, null, 'Reversed — application rejected');
    }

    public static function reverseReferralAvailable(PDO $pdo, int $shopId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $shopId, 'available', -$amount, 'subscription_referral_reversed', null, null, 'Clawed back — application rejected');
    }

    public static function releasePendingToAvailable(PDO $pdo, int $shopId, float $amount, int $orderId): void
    {
        if ($amount <= 0) {
            return;
        }
        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $shopId, 'pending', -$amount, 'release_to_available', $orderId, null, 'Earnings released');
            self::adjust($pdo, $shopId, 'available', $amount, 'order_earning_available', $orderId, null, 'Available for withdrawal');
            $pdo->prepare(
                "UPDATE shop_order_earnings SET status = 'available', released_at = NOW()
                 WHERE order_id = ? AND shop_id = ? AND status = 'pending'"
            )->execute([$orderId, $shopId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function requestWithdrawal(PDO $pdo, int $shopId, int $userId, float $amount, string $method, array $details): array
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Withdrawal amount must be greater than zero.');
        }
        $wallet = self::getWallet($pdo, $shopId);
        if ($wallet['balance_available'] < $amount) {
            throw new \InvalidArgumentException('Insufficient available balance.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO shop_withdrawals (shop_id, amount, payout_method, payout_details, requested_by)
                 VALUES (?, ?, ?, ?, ?)'
            )->execute([$shopId, $amount, $method, json_encode($details), $userId]);
            $withdrawalId = (int) $pdo->lastInsertId();

            self::adjust(
                $pdo,
                $shopId,
                'available',
                -$amount,
                'withdrawal_reserve',
                null,
                $withdrawalId,
                'Withdrawal requested'
            );
            self::adjust(
                $pdo,
                $shopId,
                'reserved',
                $amount,
                'withdrawal_reserve',
                null,
                $withdrawalId,
                'Reserved for payout'
            );

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return self::findWithdrawal($pdo, $withdrawalId) ?? [];
    }

    public static function approveWithdrawal(PDO $pdo, int $withdrawalId, int $adminId, ?string $note = null): void
    {
        $w = self::findWithdrawal($pdo, $withdrawalId);
        if ($w === null || $w['status'] !== 'requested') {
            throw new \InvalidArgumentException('Withdrawal not found or already processed.');
        }

        $pdo->beginTransaction();
        try {
            $amount = (float) $w['amount'];
            self::adjust(
                $pdo,
                (int) $w['shop_id'],
                'reserved',
                -$amount,
                'withdrawal_paid',
                null,
                $withdrawalId,
                'Withdrawal paid out'
            );
            $pdo->prepare(
                "UPDATE shop_withdrawals SET status = 'paid', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?"
            )->execute([$note, $adminId, $withdrawalId]);
            $pdo->prepare(
                "UPDATE shop_order_earnings SET status = 'paid_out'
                 WHERE shop_id = ? AND status = 'available'"
            )->execute([(int) $w['shop_id']]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function rejectWithdrawal(PDO $pdo, int $withdrawalId, int $adminId, ?string $note = null): void
    {
        $w = self::findWithdrawal($pdo, $withdrawalId);
        if ($w === null || $w['status'] !== 'requested') {
            throw new \InvalidArgumentException('Withdrawal not found or already processed.');
        }

        $amount = (float) $w['amount'];
        $shopId = (int) $w['shop_id'];

        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $shopId, 'reserved', -$amount, 'withdrawal_rejected', null, $withdrawalId, 'Withdrawal rejected');
            self::adjust($pdo, $shopId, 'available', $amount, 'withdrawal_rejected', null, $withdrawalId, 'Returned to available');
            $pdo->prepare(
                "UPDATE shop_withdrawals SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?"
            )->execute([$note, $adminId, $withdrawalId]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** @return list<array<string,mixed>> */
    public static function listWithdrawals(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT w.*, s.name AS shop_name FROM shop_withdrawals w INNER JOIN shops s ON s.id = w.shop_id';
        $params = [];
        if ($status !== null && $status !== '') {
            $sql .= ' WHERE w.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY w.requested_at DESC LIMIT 200';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => [
            'id'            => (int) $r['id'],
            'shop_id'       => (int) $r['shop_id'],
            'shop_name'     => $r['shop_name'],
            'amount'        => round((float) $r['amount'], 2),
            'status'        => $r['status'],
            'payout_method' => $r['payout_method'],
            'payout_details'=> json_decode((string) ($r['payout_details'] ?? ''), true) ?: [],
            'admin_note'    => $r['admin_note'],
            'requested_at'  => $r['requested_at'],
            'processed_at'  => $r['processed_at'],
        ], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findWithdrawal(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM shop_withdrawals WHERE id = ?');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if ($r === false) {
            return null;
        }

        return [
            'id'            => (int) $r['id'],
            'shop_id'       => (int) $r['shop_id'],
            'amount'        => round((float) $r['amount'], 2),
            'status'        => $r['status'],
            'payout_method' => $r['payout_method'],
            'payout_details'=> json_decode((string) ($r['payout_details'] ?? ''), true) ?: [],
            'admin_note'    => $r['admin_note'],
            'requested_at'  => $r['requested_at'],
            'processed_at'  => $r['processed_at'],
        ];
    }

    private static function adjust(
        PDO $pdo,
        int $shopId,
        string $bucket,
        float $amount,
        string $type,
        ?int $orderId,
        ?int $withdrawalId,
        string $note
    ): void {
        $col = match ($bucket) {
            'pending'   => 'balance_pending',
            'available' => 'balance_available',
            'reserved'  => 'balance_reserved',
            default     => throw new \InvalidArgumentException('Invalid bucket.'),
        };

        $pdo->prepare("UPDATE shop_wallets SET {$col} = {$col} + ? WHERE shop_id = ?")->execute([$amount, $shopId]);
        $wallet = self::getWallet($pdo, $shopId);
        $after = $wallet['balance_' . $bucket];

        $pdo->prepare(
            'INSERT INTO shop_wallet_transactions
                (shop_id, amount, balance_bucket, balance_after, type, order_id, withdrawal_id, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$shopId, $amount, $bucket, $after, $type, $orderId, $withdrawalId, $note]);
    }
}
