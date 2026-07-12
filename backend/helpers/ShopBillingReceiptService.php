<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** Shop billing receipts, Paystack fee math, saved cards, auto-renew charges. */
final class ShopBillingReceiptService
{
    /**
     * @return array{
     *   mode:string,percent:float,flat_ghs:float,note:?string,
     *   platform_amount_ghs:float,processor_fee_ghs:float,charge_amount_ghs:float
     * }
     */
    public static function quoteCharge(PDO $pdo, float $platformAmountGhs): array
    {
        $settings = ShopBillingService::loadSettings($pdo);
        $mode = (string) ($settings['paystack_fee_mode'] ?? 'absorb');
        if (!in_array($mode, ['absorb', 'pass_to_payer'], true)) {
            $mode = 'absorb';
        }
        $percent = max(0.0, (float) ($settings['paystack_fee_percent'] ?? 1.95));
        $flat = max(0.0, (float) ($settings['paystack_fee_flat_ghs'] ?? 0));
        $platform = max(0.0, round($platformAmountGhs, 2));

        $fee = $platform <= 0
            ? 0.0
            : round(($platform * $percent / 100.0) + $flat, 2);

        $charge = $mode === 'pass_to_payer' && $platform > 0
            ? round($platform + $fee, 2)
            : $platform;

        return [
            'mode'                 => $mode,
            'percent'              => $percent,
            'flat_ghs'             => $flat,
            'note'                 => $settings['paystack_fee_note'] ?? null,
            'platform_amount_ghs'  => $platform,
            'processor_fee_ghs'    => $fee,
            'charge_amount_ghs'    => $charge,
        ];
    }

    public static function nextReceiptNumber(PDO $pdo): string
    {
        $prefix = 'DPM-' . date('Ym') . '-';
        try {
            $stmt = $pdo->prepare(
                'SELECT receipt_number FROM shop_billing_payments
                 WHERE receipt_number LIKE ? ORDER BY id DESC LIMIT 1'
            );
            $stmt->execute([$prefix . '%']);
            $last = $stmt->fetchColumn();
            $seq = 1;
            if (is_string($last) && preg_match('/-(\d+)$/', $last, $m) === 1) {
                $seq = (int) $m[1] + 1;
            }
        } catch (\Throwable) {
            $seq = random_int(1000, 9999);
        }

        return $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }

    /**
     * @param array<string,mixed> $extra
     */
    public static function recordComplimentary(
        PDO $pdo,
        ?int $shopId,
        ?int $applicationId,
        string $kind,
        string $notes,
        float $listFee = 0.0,
        ?string $paystackRef = null
    ): ?array {
        $ref = $paystackRef ?: ('FREE-' . strtoupper($kind) . '-' . ($shopId ?: $applicationId ?: 0) . '-' . bin2hex(random_bytes(3)));
        $receipt = self::nextReceiptNumber($pdo);

        try {
            $pdo->prepare(
                'INSERT INTO shop_billing_payments
                    (receipt_number, shop_id, application_id, payment_type, amount_ghs, platform_amount_ghs,
                     processor_fee_ghs, fee_mode, is_complimentary, channel, notes, paystack_ref, status, paid_at)
                 VALUES (?, ?, ?, ?, 0, ?, 0, ?, 1, ?, ?, ?, ?, NOW())'
            )->execute([
                $receipt,
                $shopId,
                $applicationId,
                'complimentary',
                $listFee,
                'absorb',
                'free',
                $notes,
                $ref,
                'paid',
            ]);
        } catch (\Throwable) {
            try {
                $pdo->prepare(
                    'INSERT INTO shop_billing_payments
                        (shop_id, application_id, payment_type, amount_ghs, paystack_ref, status, paid_at)
                     VALUES (?, ?, ?, 0, ?, ?, NOW())'
                )->execute([$shopId, $applicationId, 'registration', $ref, 'paid']);
            } catch (\Throwable) {
                return null;
            }
        }

        return self::findByReference($pdo, $ref);
    }

    public static function finalizePaidReceipt(PDO $pdo, string $reference, ?array $paystackData = null): void
    {
        $row = self::findByReference($pdo, $reference);
        if ($row === null) {
            return;
        }

        $receipt = $row['receipt_number'] ?? null;
        if ($receipt === null || $receipt === '') {
            $receipt = self::nextReceiptNumber($pdo);
        }

        $channel = null;
        $last4 = null;
        if (is_array($paystackData)) {
            $channel = isset($paystackData['channel']) ? (string) $paystackData['channel'] : null;
            $auth = $paystackData['authorization'] ?? null;
            if (is_array($auth) && !empty($auth['last4'])) {
                $last4 = (string) $auth['last4'];
            }
        }

        try {
            $pdo->prepare(
                'UPDATE shop_billing_payments SET
                    receipt_number = COALESCE(receipt_number, ?),
                    status = ?,
                    paid_at = COALESCE(paid_at, NOW()),
                    channel = COALESCE(?, channel),
                    card_last4 = COALESCE(?, card_last4)
                 WHERE paystack_ref = ?'
            )->execute([$receipt, 'paid', $channel, $last4, $reference]);
        } catch (\Throwable) {
            $pdo->prepare(
                'UPDATE shop_billing_payments SET status = ?, paid_at = COALESCE(paid_at, NOW()) WHERE paystack_ref = ?'
            )->execute(['paid', $reference]);
        }
    }

    /** @return array<string,mixed>|null */
    public static function findByReference(PDO $pdo, string $reference): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM shop_billing_payments WHERE paystack_ref = ? LIMIT 1');
        $stmt->execute([$reference]);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    /** @return array<string,mixed>|null */
    public static function findByIdForShop(PDO $pdo, int $paymentId, int $shopId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT * FROM shop_billing_payments WHERE id = ? AND shop_id = ? LIMIT 1'
        );
        $stmt->execute([$paymentId, $shopId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::enrichReceipt($pdo, $row);
    }

    /** @return list<array<string,mixed>> */
    public static function listForShop(PDO $pdo, int $shopId, int $limit = 100): array
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT * FROM shop_billing_payments
                 WHERE shop_id = ? AND status = ?
                 ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
                 LIMIT ?'
            );
            $stmt->bindValue(1, $shopId, PDO::PARAM_INT);
            $stmt->bindValue(2, 'paid', PDO::PARAM_STR);
            $stmt->bindValue(3, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll() ?: [];
        } catch (\Throwable) {
            return [];
        }

        return array_map(static fn (array $r) => self::enrichReceipt($pdo, $r), $rows);
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    public static function enrichReceipt(PDO $pdo, array $row): array
    {
        $settings = ShopBillingService::loadSettings($pdo);
        $company = ['company_name' => 'DanyPathMart', 'email' => null, 'phone' => null];
        try {
            $c = $pdo->query(
                'SELECT company_name, email, phone FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if (is_array($c)) {
                $company = [
                    'company_name' => $c['company_name'] ?: 'DanyPathMart',
                    'email'        => $c['email'] ?? null,
                    'phone'        => $c['phone'] ?? null,
                ];
            }
        } catch (\Throwable) {
        }

        $platform = $row['platform_amount_ghs'] !== null
            ? (float) $row['platform_amount_ghs']
            : (float) ($row['amount_ghs'] ?? 0);
        $processor = (float) ($row['processor_fee_ghs'] ?? 0);
        $charged = (float) ($row['amount_ghs'] ?? 0);
        $complimentary = !empty($row['is_complimentary']) || $charged <= 0.0
            || ($row['payment_type'] ?? '') === 'complimentary';

        return [
            'id'                   => (int) $row['id'],
            'receipt_number'       => $row['receipt_number'] ?? ('DPM-' . $row['id']),
            'shop_id'              => $row['shop_id'] !== null ? (int) $row['shop_id'] : null,
            'application_id'       => $row['application_id'] !== null ? (int) $row['application_id'] : null,
            'payment_type'         => $row['payment_type'],
            'billing_period'       => $row['billing_period'] ?? null,
            'amount_ghs'           => $charged,
            'platform_amount_ghs'  => $platform,
            'processor_fee_ghs'    => $processor,
            'fee_mode'             => $row['fee_mode'] ?? ($settings['paystack_fee_mode'] ?? 'absorb'),
            'is_complimentary'     => $complimentary,
            'channel'              => $row['channel'] ?? null,
            'card_last4'           => $row['card_last4'] ?? null,
            'notes'                => $row['notes'] ?? null,
            'paystack_ref'         => $row['paystack_ref'],
            'status'               => $row['status'],
            'paid_at'              => $row['paid_at'] ?? $row['created_at'] ?? null,
            'created_at'           => $row['created_at'] ?? null,
            'company'              => [
                'company_name' => $company['company_name'] ?? 'DanyPathMart',
                'email'        => $company['email'] ?? null,
                'phone'        => $company['phone'] ?? null,
            ],
            'fee_policy_note'      => $settings['paystack_fee_note'] ?? null,
            'lines'                => self::receiptLines($complimentary, $platform, $processor, $charged, (string) ($row['fee_mode'] ?? 'absorb')),
        ];
    }

    /**
     * @return list<array{label:string,amount:float}>
     */
    private static function receiptLines(
        bool $complimentary,
        float $platform,
        float $processor,
        float $charged,
        string $mode
    ): array {
        if ($complimentary) {
            return [
                ['label' => 'Platform fee', 'amount' => $platform],
                ['label' => 'Complimentary / free period', 'amount' => -$platform],
                ['label' => 'Amount paid', 'amount' => 0.0],
            ];
        }

        $lines = [['label' => 'Platform subscription fee', 'amount' => $platform]];
        if ($mode === 'pass_to_payer' && $processor > 0) {
            $lines[] = ['label' => 'Estimated Paystack processing fee', 'amount' => $processor];
        } elseif ($processor > 0) {
            $lines[] = ['label' => 'Paystack fee (absorbed by platform — estimate)', 'amount' => 0.0];
        }
        $lines[] = ['label' => 'Amount charged', 'amount' => $charged];

        return $lines;
    }

    /** @return list<array<string,mixed>> */
    public static function listPaymentMethods(PDO $pdo, int $shopId): array
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT id, shop_id, card_type, last4, exp_month, exp_year, bank, is_default, status, created_at
                 FROM shop_billing_payment_methods
                 WHERE shop_id = ? AND status = ? ORDER BY is_default DESC, id DESC'
            );
            $stmt->execute([$shopId, 'active']);

            return $stmt->fetchAll() ?: [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param array<string,mixed> $authorization Paystack authorization object
     */
    public static function saveAuthorization(PDO $pdo, int $shopId, array $authorization, ?string $customerCode = null): void
    {
        $code = trim((string) ($authorization['authorization_code'] ?? ''));
        if ($code === '' || empty($authorization['reusable'])) {
            return;
        }

        try {
            $pdo->prepare(
                'UPDATE shop_billing_payment_methods SET is_default = 0 WHERE shop_id = ? AND status = ?'
            )->execute([$shopId, 'active']);

            $pdo->prepare(
                'INSERT INTO shop_billing_payment_methods
                    (shop_id, authorization_code, paystack_customer_code, card_type, last4, exp_month, exp_year, bank, reusable, is_default, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
                 ON DUPLICATE KEY UPDATE
                    paystack_customer_code = VALUES(paystack_customer_code),
                    card_type = VALUES(card_type),
                    last4 = VALUES(last4),
                    exp_month = VALUES(exp_month),
                    exp_year = VALUES(exp_year),
                    bank = VALUES(bank),
                    reusable = 1,
                    is_default = 1,
                    status = ?,
                    updated_at = NOW()'
            )->execute([
                $shopId,
                $code,
                $customerCode,
                $authorization['card_type'] ?? $authorization['brand'] ?? null,
                $authorization['last4'] ?? null,
                isset($authorization['exp_month']) ? (string) $authorization['exp_month'] : null,
                isset($authorization['exp_year']) ? (string) $authorization['exp_year'] : null,
                $authorization['bank'] ?? null,
                'active',
                'active',
            ]);

            if ($customerCode) {
                $pdo->prepare(
                    'UPDATE shop_subscriptions SET paystack_customer_code = ? WHERE shop_id = ?'
                )->execute([$customerCode, $shopId]);
            }
        } catch (\Throwable) {
            // Migration 067 may not be applied yet.
        }
    }

    public static function removePaymentMethod(PDO $pdo, int $shopId, int $methodId): bool
    {
        $stmt = $pdo->prepare(
            'UPDATE shop_billing_payment_methods SET status = ?, is_default = 0 WHERE id = ? AND shop_id = ?'
        );
        $stmt->execute(['removed', $methodId, $shopId]);

        return $stmt->rowCount() > 0;
    }

    public static function setDefaultPaymentMethod(PDO $pdo, int $shopId, int $methodId): bool
    {
        $check = $pdo->prepare(
            'SELECT id FROM shop_billing_payment_methods WHERE id = ? AND shop_id = ? AND status = ?'
        );
        $check->execute([$methodId, $shopId, 'active']);
        if ($check->fetch() === false) {
            return false;
        }
        $pdo->prepare(
            'UPDATE shop_billing_payment_methods SET is_default = 0 WHERE shop_id = ?'
        )->execute([$shopId]);
        $pdo->prepare(
            'UPDATE shop_billing_payment_methods SET is_default = 1 WHERE id = ? AND shop_id = ?'
        )->execute([$methodId, $shopId]);

        return true;
    }

    public static function setAutoRenew(PDO $pdo, int $shopId, bool $enabled, ?string $period = null): void
    {
        $settings = ShopBillingService::loadSettings($pdo);
        $period = $period !== null
            ? ShopBillingService::normalizePeriod($period, $settings)
            : null;

        try {
            $pdo->prepare(
                'INSERT INTO shop_subscriptions (shop_id, status, period_start, period_end, auto_renew, preferred_billing_period)
                 VALUES (?, ?, CURDATE(), CURDATE(), ?, ?)
                 ON DUPLICATE KEY UPDATE auto_renew = ?, preferred_billing_period = COALESCE(?, preferred_billing_period), updated_at = NOW()'
            )->execute([
                $shopId,
                'active',
                $enabled ? 1 : 0,
                $period,
                $enabled ? 1 : 0,
                $period,
            ]);
        } catch (\Throwable $e) {
            throw new \InvalidArgumentException('Could not update auto-renew. Run migration 067.');
        }
    }

    /** @return array<string,mixed>|null default active method with secret auth code */
    public static function defaultAuthorization(PDO $pdo, int $shopId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT * FROM shop_billing_payment_methods
             WHERE shop_id = ? AND status = ? ORDER BY is_default DESC, id DESC LIMIT 1'
        );
        $stmt->execute([$shopId, 'active']);
        $row = $stmt->fetch();

        return $row === false ? null : $row;
    }

    /**
     * Charge saved card for renewal. Returns payment row or throws.
     *
     * @return array<string,mixed>
     */
    public static function chargeSavedCardForRenewal(PDO $pdo, int $shopId, ?string $period = null): array
    {
        $shop = ShopService::findById($pdo, $shopId);
        if ($shop === null) {
            throw new \InvalidArgumentException('Shop not found.');
        }

        $email = '';
        $owner = $pdo->prepare(
            "SELECT u.email FROM shop_members sm INNER JOIN users u ON u.id = sm.user_id
             WHERE sm.shop_id = ? AND sm.role = 'owner' LIMIT 1"
        );
        $owner->execute([$shopId]);
        $email = (string) ($owner->fetchColumn() ?: '');
        if ($email === '') {
            $email = (string) ($shop['contact_email'] ?? '');
        }
        if ($email === '') {
            throw new \InvalidArgumentException('Shop has no billing email.');
        }

        $method = self::defaultAuthorization($pdo, $shopId);
        if ($method === null) {
            throw new \InvalidArgumentException('Add a card before enabling auto-renew charges.');
        }

        $settings = ShopBillingService::loadSettings($pdo);
        $period = ShopBillingService::resolveRenewalPeriod($settings, $period);
        $sub = ShopBillingService::subscriptionForShop($pdo, $shopId);
        if ($sub && !empty($sub['preferred_billing_period'])) {
            $period = ShopBillingService::resolveRenewalPeriod($settings, (string) $sub['preferred_billing_period']);
        }
        $platform = ShopBillingService::renewalFeeForPeriod($settings, $period);
        if ($platform <= 0) {
            throw new \InvalidArgumentException('Renewal plan is not available.');
        }

        $quote = self::quoteCharge($pdo, $platform);
        $ref = 'SHOP-AUTO-' . $shopId . '-' . bin2hex(random_bytes(4));
        ShopBillingService::insertPendingPaymentPublic(
            $pdo,
            $ref,
            $quote['charge_amount_ghs'],
            'renewal',
            $shopId,
            null,
            $period,
            $quote
        );

        $secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
        $configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');

        if (!$configured) {
            ShopBillingService::markRenewalPaid($pdo, $shopId, $ref, $period);
            self::finalizePaidReceipt($pdo, $ref, ['channel' => 'card']);

            return self::findByReference($pdo, $ref) ?? [];
        }

        $payload = json_encode([
            'authorization_code' => $method['authorization_code'],
            'email'              => $email,
            'amount'             => (int) round($quote['charge_amount_ghs'] * 100),
            'currency'           => 'GHS',
            'reference'          => $ref,
            'metadata'           => [
                'billing_type'   => 'shop_renewal',
                'shop_id'        => $shopId,
                'billing_period' => $period,
                'auto_renew'     => true,
            ],
        ]);

        $ch = curl_init('https://api.paystack.co/transaction/charge_authorization');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $secret,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode((string) $response, true);
        if ($httpCode >= 400 || !is_array($data) || empty($data['status'])) {
            $pdo->prepare('UPDATE shop_billing_payments SET status = ? WHERE paystack_ref = ?')
                ->execute(['failed', $ref]);
            $msg = is_array($data) ? (string) ($data['message'] ?? 'Charge failed') : 'Charge failed';
            throw new \RuntimeException($msg);
        }

        $tx = $data['data'] ?? [];
        if (($tx['status'] ?? '') === 'success') {
            ShopBillingService::markRenewalPaid($pdo, $shopId, $ref, $period);
            self::finalizePaidReceipt($pdo, $ref, is_array($tx) ? $tx : null);
            if (!empty($tx['authorization']) && is_array($tx['authorization'])) {
                self::saveAuthorization(
                    $pdo,
                    $shopId,
                    $tx['authorization'],
                    isset($tx['customer']['customer_code']) ? (string) $tx['customer']['customer_code'] : null
                );
            }
        }

        return self::findByReference($pdo, $ref) ?? [];
    }

    /** Process shops with auto_renew due (period_end <= today). */
    public static function runAutoRenewDue(PDO $pdo): int
    {
        try {
            $stmt = $pdo->query(
                "SELECT shop_id, preferred_billing_period FROM shop_subscriptions
                 WHERE auto_renew = 1 AND status IN ('active','past_due')
                   AND period_end IS NOT NULL AND period_end <= CURDATE()"
            );
        } catch (\Throwable) {
            return 0;
        }

        $count = 0;
        foreach ($stmt->fetchAll() ?: [] as $row) {
            try {
                self::chargeSavedCardForRenewal(
                    $pdo,
                    (int) $row['shop_id'],
                    $row['preferred_billing_period'] !== null ? (string) $row['preferred_billing_period'] : null
                );
                $count++;
            } catch (\Throwable) {
                try {
                    $pdo->prepare(
                        "UPDATE shop_subscriptions SET status = 'past_due' WHERE shop_id = ?"
                    )->execute([(int) $row['shop_id']]);
                } catch (\Throwable) {
                }
            }
        }

        return $count;
    }
}
