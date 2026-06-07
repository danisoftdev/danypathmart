<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** G2 — refer a club leader; wallet credit on first paid order. */
final class ReferralService
{
    /**
     * @return array{enabled:bool, amount:float}
     */
    public static function settings(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT referral_credit_enabled, referral_credit_amount
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return ['enabled' => false, 'amount' => 0.0];
        }

        if ($row === false) {
            return ['enabled' => false, 'amount' => 0.0];
        }

        return [
            'enabled' => (int) ($row['referral_credit_enabled'] ?? 0) === 1,
            'amount'  => round((float) ($row['referral_credit_amount'] ?? 0), 2),
        ];
    }

    public static function ensureCode(PDO $pdo, int $userId): string
    {
        $stmt = $pdo->prepare('SELECT referral_code FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $existing = $stmt->fetchColumn();
        if ($existing !== false && trim((string) $existing) !== '') {
            return strtoupper(trim((string) $existing));
        }

        $code = self::generateUniqueCode($pdo, $userId);
        $pdo->prepare('UPDATE users SET referral_code = ? WHERE id = ?')->execute([$code, $userId]);

        return $code;
    }

    public static function resolveReferrer(PDO $pdo, ?string $code): ?int
    {
        $code = strtoupper(trim((string) ($code ?? '')));
        if ($code === '') {
            return null;
        }

        $stmt = $pdo->prepare(
            "SELECT id FROM users WHERE referral_code = ? AND role = 'customer' AND status != 'disabled'"
        );
        $stmt->execute([$code]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /**
     * @return array{valid:bool, referrer_name:?string}
     */
    public static function validate(PDO $pdo, string $code): array
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled']) {
            return ['valid' => false, 'referrer_name' => null];
        }

        $referrerId = self::resolveReferrer($pdo, $code);
        if ($referrerId === null) {
            return ['valid' => false, 'referrer_name' => null];
        }

        $stmt = $pdo->prepare('SELECT name FROM users WHERE id = ?');
        $stmt->execute([$referrerId]);
        $name = $stmt->fetchColumn();

        return [
            'valid'         => true,
            'referrer_name' => $name !== false ? (string) $name : null,
            'credit_amount' => $settings['amount'],
        ];
    }

    public static function attachToOrder(PDO $pdo, int $orderId, int $buyerId, ?string $code): void
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled']) {
            return;
        }

        $referrerId = self::resolveReferrer($pdo, $code);
        if ($referrerId === null || $referrerId === $buyerId) {
            return;
        }

        $normalized = strtoupper(trim((string) ($code ?? '')));
        $pdo->prepare(
            'UPDATE orders SET referral_code_used = ?, referrer_user_id = ? WHERE id = ?'
        )->execute([$normalized !== '' ? $normalized : null, $referrerId, $orderId]);
    }

    public static function onOrderPaid(PDO $pdo, int $orderId): void
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled'] || $settings['amount'] <= 0) {
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT id, user_id, referrer_user_id, referral_code_used FROM orders WHERE id = ?'
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false || $order['referrer_user_id'] === null) {
            return;
        }

        $buyerId = (int) $order['user_id'];
        $referrerId = (int) $order['referrer_user_id'];
        if ($referrerId === $buyerId) {
            return;
        }

        $dup = $pdo->prepare(
            'SELECT 1 FROM referral_credits WHERE referrer_user_id = ? AND referred_user_id = ?'
        );
        $dup->execute([$referrerId, $buyerId]);
        if ($dup->fetchColumn() !== false) {
            return;
        }

        $prior = $pdo->prepare(
            "SELECT 1 FROM orders
             WHERE user_id = ? AND payment_status = 'paid' AND id != ?
             LIMIT 1"
        );
        $prior->execute([$buyerId, $orderId]);
        if ($prior->fetchColumn() !== false) {
            return;
        }

        $amount = $settings['amount'];
        $note = 'Referral credit — first paid order #' . $orderId;

        try {
            WalletService::credit($pdo, $referrerId, $amount, 'referral_credit', $orderId, $note, null);
        } catch (\Throwable) {
            WalletService::credit($pdo, $referrerId, $amount, 'admin_credit', $orderId, $note, null);
        }

        $pdo->prepare(
            'INSERT INTO referral_credits (referrer_user_id, referred_user_id, order_id, amount)
             VALUES (?, ?, ?, ?)'
        )->execute([$referrerId, $buyerId, $orderId, $amount]);

        NotificationService::notifyUser(
            $pdo,
            $referrerId,
            'Referral credit earned',
            'A club you referred completed their first order. '
            . number_format($amount, 2) . ' GHS was added to your wallet.',
            '/dashboard/wallet',
            'order_update'
        );
    }

    private static function generateUniqueCode(PDO $pdo, int $userId): string
    {
        for ($i = 0; $i < 8; $i++) {
            $code = 'CLUB-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $chk = $pdo->prepare('SELECT 1 FROM users WHERE referral_code = ?');
            $chk->execute([$code]);
            if ($chk->fetchColumn() === false) {
                return $code;
            }
        }

        return 'CLUB-' . str_pad((string) $userId, 6, '0', STR_PAD_LEFT);
    }
}
