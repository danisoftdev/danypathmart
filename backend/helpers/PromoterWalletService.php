<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Promoter wallet ledger for subscription referral earnings. */
final class PromoterWalletService
{
    /** @return array<string,mixed> */
    public static function getWallet(PDO $pdo, int $promoterId): array
    {
        $stmt = $pdo->prepare('SELECT * FROM promoter_wallets WHERE promoter_id = ?');
        $stmt->execute([$promoterId]);
        $row = $stmt->fetch();
        if ($row === false) {
            $pdo->prepare('INSERT INTO promoter_wallets (promoter_id) VALUES (?)')->execute([$promoterId]);

            return [
                'promoter_id'       => $promoterId,
                'balance_pending'   => 0.0,
                'balance_available' => 0.0,
                'balance_reserved'  => 0.0,
            ];
        }

        return [
            'promoter_id'       => $promoterId,
            'balance_pending'   => round((float) $row['balance_pending'], 2),
            'balance_available' => round((float) $row['balance_available'], 2),
            'balance_reserved'  => round((float) $row['balance_reserved'], 2),
        ];
    }

    public static function creditPending(PDO $pdo, int $promoterId, float $amount, int $earningId, string $note): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $promoterId, 'pending', $amount, 'subscription_referral_pending', $earningId, null, $note);
    }

    public static function releasePending(PDO $pdo, int $promoterId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $promoterId, 'pending', -$amount, 'subscription_referral_release', $earningId, null, 'Released after shop approval');
            self::adjust($pdo, $promoterId, 'available', $amount, 'subscription_referral_available', $earningId, null, 'Available for withdrawal');
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public static function reversePending(PDO $pdo, int $promoterId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $promoterId, 'pending', -$amount, 'subscription_referral_reversed', $earningId, null, 'Reversed — application rejected');
    }

    public static function reverseAvailable(PDO $pdo, int $promoterId, float $amount, int $earningId): void
    {
        if ($amount <= 0) {
            return;
        }
        self::adjust($pdo, $promoterId, 'available', -$amount, 'subscription_referral_reversed', $earningId, null, 'Clawed back — application rejected');
    }

    /** @return list<array<string,mixed>> */
    public static function listTransactions(PDO $pdo, int $promoterId, int $limit = 50): array
    {
        $limit = max(1, min($limit, 100));
        $stmt = $pdo->prepare(
            'SELECT id, amount, balance_bucket, balance_after, type, earning_id, withdrawal_id, note, created_at
             FROM promoter_wallet_transactions WHERE promoter_id = ?
             ORDER BY created_at DESC, id DESC LIMIT ' . $limit
        );
        $stmt->execute([$promoterId]);

        return array_map(static fn (array $r): array => [
            'id'             => (int) $r['id'],
            'amount'         => round((float) $r['amount'], 2),
            'balance_bucket' => $r['balance_bucket'],
            'balance_after'  => round((float) $r['balance_after'], 2),
            'type'           => $r['type'],
            'earning_id'     => $r['earning_id'] !== null ? (int) $r['earning_id'] : null,
            'withdrawal_id'  => $r['withdrawal_id'] !== null ? (int) $r['withdrawal_id'] : null,
            'note'           => $r['note'],
            'created_at'     => $r['created_at'],
        ], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $details */
    public static function requestWithdrawal(PDO $pdo, int $promoterId, int $userId, float $amount, string $method, array $details): array
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Withdrawal amount must be greater than zero.');
        }
        $wallet = self::getWallet($pdo, $promoterId);
        if ($wallet['balance_available'] < $amount) {
            throw new \InvalidArgumentException('Insufficient available balance.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO promoter_withdrawals (promoter_id, amount, payout_method, payout_details, requested_by)
                 VALUES (?, ?, ?, ?, ?)'
            )->execute([$promoterId, $amount, $method, json_encode($details), $userId]);
            $withdrawalId = (int) $pdo->lastInsertId();

            self::adjust($pdo, $promoterId, 'available', -$amount, 'withdrawal_reserve', null, $withdrawalId, 'Withdrawal requested');
            self::adjust($pdo, $promoterId, 'reserved', $amount, 'withdrawal_reserve', null, $withdrawalId, 'Reserved for payout');

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
        $amount = (float) $w['amount'];
        $promoterId = (int) $w['promoter_id'];

        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $promoterId, 'reserved', -$amount, 'withdrawal_paid', null, $withdrawalId, 'Withdrawal paid');
            $pdo->prepare(
                "UPDATE promoter_withdrawals SET status = 'paid', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?"
            )->execute([$note, $adminId, $withdrawalId]);
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
        $promoterId = (int) $w['promoter_id'];

        $pdo->beginTransaction();
        try {
            self::adjust($pdo, $promoterId, 'reserved', -$amount, 'withdrawal_rejected', null, $withdrawalId, 'Withdrawal rejected');
            self::adjust($pdo, $promoterId, 'available', $amount, 'withdrawal_rejected', null, $withdrawalId, 'Returned to available');
            $pdo->prepare(
                "UPDATE promoter_withdrawals SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?"
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
        $sql = 'SELECT w.*, p.display_name AS promoter_name, p.code AS promoter_code
                FROM promoter_withdrawals w
                INNER JOIN promoters p ON p.id = w.promoter_id';
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
            'promoter_id'   => (int) $r['promoter_id'],
            'promoter_name' => $r['promoter_name'],
            'promoter_code' => $r['promoter_code'],
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
        $stmt = $pdo->prepare('SELECT * FROM promoter_withdrawals WHERE id = ?');
        $stmt->execute([$id]);
        $r = $stmt->fetch();
        if ($r === false) {
            return null;
        }

        return [
            'id'            => (int) $r['id'],
            'promoter_id'   => (int) $r['promoter_id'],
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
        int $promoterId,
        string $bucket,
        float $amount,
        string $type,
        ?int $earningId,
        ?int $withdrawalId,
        string $note
    ): void {
        $col = match ($bucket) {
            'pending'   => 'balance_pending',
            'available' => 'balance_available',
            'reserved'  => 'balance_reserved',
            default     => throw new \InvalidArgumentException('Invalid bucket.'),
        };

        self::getWallet($pdo, $promoterId);
        $pdo->prepare("UPDATE promoter_wallets SET {$col} = {$col} + ? WHERE promoter_id = ?")
            ->execute([$amount, $promoterId]);
        $wallet = self::getWallet($pdo, $promoterId);
        $after = $wallet['balance_' . $bucket];

        $pdo->prepare(
            'INSERT INTO promoter_wallet_transactions
                (promoter_id, amount, balance_bucket, balance_after, type, earning_id, withdrawal_id, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$promoterId, $amount, $bucket, $after, $type, $earningId, $withdrawalId, $note]);
    }
}
