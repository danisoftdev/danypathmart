<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** Shop registration & renewal billing (admin-toggle, Paystack). */
final class ShopBillingService
{
    /** @return array<string,mixed> */
    public static function loadSettings(PDO $pdo): array
    {
        $defaults = [
            'shop_billing_enabled'       => false,
            'shop_registration_fee_ghs'  => 0.0,
            'shop_renewal_fee_ghs'       => 0.0,
            'shop_renewal_period'        => 'yearly',
            'shop_renewal_grace_days'    => 7,
        ];

        try {
            $row = $pdo->query(
                'SELECT shop_billing_enabled, shop_registration_fee_ghs, shop_renewal_fee_ghs,
                        shop_renewal_period, shop_renewal_grace_days
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        $period = (string) ($row['shop_renewal_period'] ?? 'yearly');

        return [
            'shop_billing_enabled'      => (int) ($row['shop_billing_enabled'] ?? 0) === 1,
            'shop_registration_fee_ghs' => max(0.0, (float) ($row['shop_registration_fee_ghs'] ?? 0)),
            'shop_renewal_fee_ghs'      => max(0.0, (float) ($row['shop_renewal_fee_ghs'] ?? 0)),
            'shop_renewal_period'       => in_array($period, ['monthly', 'yearly'], true) ? $period : 'yearly',
            'shop_renewal_grace_days'   => max(0, (int) ($row['shop_renewal_grace_days'] ?? 7)),
        ];
    }

    public static function registrationRequired(PDO $pdo): bool
    {
        $s = self::loadSettings($pdo);

        return $s['shop_billing_enabled'] && $s['shop_registration_fee_ghs'] > 0;
    }

    public static function renewalRequired(PDO $pdo): bool
    {
        $s = self::loadSettings($pdo);

        return $s['shop_billing_enabled'] && $s['shop_renewal_fee_ghs'] > 0;
    }

    /** @return array<string,mixed> */
    public static function publicSettings(PDO $pdo): array
    {
        $s = self::loadSettings($pdo);

        return [
            'enabled'          => $s['shop_billing_enabled'],
            'registration_fee' => $s['shop_registration_fee_ghs'],
            'renewal_fee'      => $s['shop_renewal_fee_ghs'],
            'renewal_period'   => $s['shop_renewal_period'],
            'currency'         => 'GHS',
        ];
    }

    public static function applicationRegistrationPaid(array $app): bool
    {
        if (!empty($app['registration_fee_waived'])) {
            return true;
        }
        if (!empty($app['registration_fee_paid'])) {
            return true;
        }

        return false;
    }

    /** @return array{requires_payment:bool,status:string} */
    public static function initialApplicationStatus(PDO $pdo): array
    {
        if (self::registrationRequired($pdo)) {
            return ['requires_payment' => true, 'status' => 'pending_payment'];
        }

        return ['requires_payment' => false, 'status' => 'new'];
    }

    /**
     * @return array{dev_mock:bool,reference:string,authorization_url:string,amount_ghs:float}
     */
    public static function initializeRegistrationPayment(PDO $pdo, int $applicationId, string $email): array
    {
        $app = ShopApplicationService::findById($pdo, $applicationId);
        if ($app === null) {
            throw new \InvalidArgumentException('Application not found.');
        }
        if ($app['status'] !== 'pending_payment') {
            throw new \InvalidArgumentException('This application does not require registration payment.');
        }
        if (self::applicationRegistrationPaid($app)) {
            throw new \InvalidArgumentException('Registration fee already paid or waived.');
        }

        $settings = self::loadSettings($pdo);
        $amountGhs = $settings['shop_registration_fee_ghs'];
        if ($amountGhs <= 0) {
            throw new \InvalidArgumentException('Registration fee is not configured.');
        }

        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $callback = $frontend . '/sell?shop_payment=registration&application_id=' . $applicationId;

        return self::initializePaystack(
            $pdo,
            $email,
            $amountGhs,
            $callback,
            [
                'billing_type'   => 'shop_registration',
                'application_id' => $applicationId,
            ],
            'registration',
            null,
            $applicationId
        );
    }

    /**
     * @return array{dev_mock:bool,reference:string,authorization_url:string,amount_ghs:float}
     */
    public static function initializeRenewalPayment(PDO $pdo, int $shopId, string $email): array
    {
        if (!self::renewalRequired($pdo)) {
            throw new \InvalidArgumentException('Shop renewal billing is not enabled.');
        }

        $settings = self::loadSettings($pdo);
        $amountGhs = $settings['shop_renewal_fee_ghs'];

        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $callback = $frontend . '/seller?shop_payment=renewal';

        return self::initializePaystack(
            $pdo,
            $email,
            $amountGhs,
            $callback,
            [
                'billing_type' => 'shop_renewal',
                'shop_id'      => $shopId,
            ],
            'renewal',
            $shopId,
            null
        );
    }

    public static function confirmFromWebhook(PDO $pdo, string $reference, array $paystackData): bool
    {
        $meta = $paystackData['metadata'] ?? [];
        if (!is_array($meta)) {
            $meta = [];
        }

        $type = (string) ($meta['billing_type'] ?? '');
        if ($type === 'shop_registration') {
            $appId = (int) ($meta['application_id'] ?? 0);
            if ($appId > 0) {
                self::markRegistrationPaid($pdo, $appId, $reference);

                return true;
            }
        }
        if ($type === 'shop_renewal') {
            $shopId = (int) ($meta['shop_id'] ?? 0);
            if ($shopId > 0) {
                self::markRenewalPaid($pdo, $shopId, $reference);

                return true;
            }
        }

        $stmt = $pdo->prepare(
            'SELECT id, application_id, shop_id, payment_type, status FROM shop_billing_payments WHERE paystack_ref = ? LIMIT 1'
        );
        $stmt->execute([$reference]);
        $row = $stmt->fetch();
        if ($row === false || $row['status'] === 'paid') {
            return false;
        }

        if ($row['payment_type'] === 'registration' && $row['application_id']) {
            self::markRegistrationPaid($pdo, (int) $row['application_id'], $reference);

            return true;
        }
        if ($row['payment_type'] === 'renewal' && $row['shop_id']) {
            self::markRenewalPaid($pdo, (int) $row['shop_id'], $reference);

            return true;
        }

        return false;
    }

    public static function markRegistrationPaid(PDO $pdo, int $applicationId, string $reference): void
    {
        $amountGhs = 0.0;
        $payStmt = $pdo->prepare(
            'SELECT amount_ghs FROM shop_billing_payments WHERE paystack_ref = ? AND payment_type = ? LIMIT 1'
        );
        $payStmt->execute([$reference, 'registration']);
        $amt = $payStmt->fetchColumn();
        if ($amt !== false) {
            $amountGhs = (float) $amt;
        }

        $pdo->prepare(
            'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
        )->execute(['paid', $reference]);

        $pdo->prepare(
            'UPDATE shop_applications SET registration_fee_paid = 1, registration_payment_ref = ?, status = ? WHERE id = ?'
        )->execute([$reference, 'new', $applicationId]);

        if ($amountGhs > 0) {
            SubscriptionReferralService::payOnRegistration($pdo, $applicationId, $amountGhs, $reference);
        }
    }

    public static function markRenewalPaid(PDO $pdo, int $shopId, string $reference): void
    {
        $pdo->prepare(
            'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
        )->execute(['paid', $reference]);

        self::extendSubscription($pdo, $shopId);
        $pdo->prepare('UPDATE shops SET status = ?, is_published = 1 WHERE id = ?')->execute(['active', $shopId]);
    }

    public static function waiveApplicationRegistration(PDO $pdo, int $applicationId, int $adminUserId, ?string $note = null): void
    {
        $pdo->prepare(
            'UPDATE shop_applications SET registration_fee_waived = 1, status = ?, admin_note = COALESCE(?, admin_note) WHERE id = ? AND status = ?'
        )->execute(['new', $note, $applicationId, 'pending_payment']);
    }

    public static function waiveShopSubscription(PDO $pdo, int $shopId, int $adminUserId, ?string $note = null, ?string $until = null): void
    {
        $untilDate = $until ?: date('Y-m-d', strtotime('+1 year'));
        $pdo->prepare(
            'INSERT INTO shop_subscriptions (shop_id, status, period_start, period_end, waived_until, waiver_note, waived_by)
             VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = ?, waived_until = ?, waiver_note = ?, waived_by = ?, updated_at = NOW()'
        )->execute([
            $shopId, 'waived', $untilDate, $untilDate, $note, $adminUserId,
            'waived', $untilDate, $note, $adminUserId,
        ]);
        $pdo->prepare('UPDATE shops SET status = ?, is_published = 1 WHERE id = ?')->execute(['active', $shopId]);
    }

    public static function createSubscriptionOnApprove(PDO $pdo, int $shopId): void
    {
        if (!self::loadSettings($pdo)['shop_billing_enabled']) {
            return;
        }

        $settings = self::loadSettings($pdo);
        $end = $settings['shop_renewal_period'] === 'monthly'
            ? date('Y-m-d', strtotime('+1 month'))
            : date('Y-m-d', strtotime('+1 year'));

        $pdo->prepare(
            'INSERT INTO shop_subscriptions (shop_id, status, period_start, period_end)
             VALUES (?, ?, CURDATE(), ?)
             ON DUPLICATE KEY UPDATE status = ?, period_start = CURDATE(), period_end = ?, updated_at = NOW()'
        )->execute([$shopId, 'active', $end, 'active', $end]);
    }

    public static function isShopInGoodStanding(PDO $pdo, int $shopId): bool
    {
        if (!self::loadSettings($pdo)['shop_billing_enabled']) {
            return true;
        }
        if (!self::renewalRequired($pdo)) {
            return true;
        }

        $stmt = $pdo->prepare('SELECT status, period_end, waived_until FROM shop_subscriptions WHERE shop_id = ?');
        $stmt->execute([$shopId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return true;
        }

        if ($row['status'] === 'waived') {
            $until = $row['waived_until'] ?? null;

            return $until === null || $until >= date('Y-m-d');
        }

        if ($row['status'] === 'active') {
            $end = (string) ($row['period_end'] ?? '');
            if ($end === '' || $end >= date('Y-m-d')) {
                return true;
            }
            $grace = self::loadSettings($pdo)['shop_renewal_grace_days'];
            $graceEnd = date('Y-m-d', strtotime($end . ' +' . $grace . ' days'));

            return date('Y-m-d') <= $graceEnd;
        }

        return false;
    }

    /** @return array<string,mixed>|null */
    public static function subscriptionForShop(PDO $pdo, int $shopId): ?array
    {
        try {
            $stmt = $pdo->prepare('SELECT * FROM shop_subscriptions WHERE shop_id = ?');
            $stmt->execute([$shopId]);
            $row = $stmt->fetch();
        } catch (\Throwable) {
            return null;
        }

        return $row === false ? null : $row;
    }

    /** @return list<array<string,mixed>> */
    public static function listRecentPayments(PDO $pdo, int $limit = 50): array
    {
        try {
            $stmt = $pdo->prepare(
                'SELECT p.*, s.name AS shop_name, a.business_name AS application_name
                 FROM shop_billing_payments p
                 LEFT JOIN shops s ON s.id = p.shop_id
                 LEFT JOIN shop_applications a ON a.id = p.application_id
                 ORDER BY p.created_at DESC LIMIT ?'
            );
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();

            return $stmt->fetchAll() ?: [];
        } catch (\Throwable) {
            return [];
        }
    }

    private static function extendSubscription(PDO $pdo, int $shopId): void
    {
        $settings = self::loadSettings($pdo);
        $start = date('Y-m-d');
        $end = $settings['shop_renewal_period'] === 'monthly'
            ? date('Y-m-d', strtotime('+1 month'))
            : date('Y-m-d', strtotime('+1 year'));

        $pdo->prepare(
            'INSERT INTO shop_subscriptions (shop_id, status, period_start, period_end)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = ?, period_start = ?, period_end = ?, waived_until = NULL, updated_at = NOW()'
        )->execute([$shopId, 'active', $start, $end, 'active', $start, $end]);
    }

    /**
     * @param array<string,mixed> $metadata
     * @return array{dev_mock:bool,reference:string,authorization_url:string,amount_ghs:float}
     */
    private static function initializePaystack(
        PDO $pdo,
        string $email,
        float $amountGhs,
        string $callbackUrl,
        array $metadata,
        string $paymentType,
        ?int $shopId,
        ?int $applicationId
    ): array {
        $amountPesewas = (int) round($amountGhs * 100);
        if ($amountPesewas <= 0) {
            throw new \InvalidArgumentException('Invalid payment amount.');
        }

        $secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
        $configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');

        if (!$configured) {
            $ref = 'SHOP-DEV-' . bin2hex(random_bytes(6));
            self::insertPendingPayment($pdo, $ref, $amountGhs, $paymentType, $shopId, $applicationId);

            return [
                'dev_mock'          => true,
                'reference'         => $ref,
                'authorization_url' => $callbackUrl . '&reference=' . urlencode($ref) . '&mock=1',
                'amount_ghs'        => $amountGhs,
            ];
        }

        $payload = json_encode([
            'email'        => $email,
            'amount'       => $amountPesewas,
            'currency'     => 'GHS',
            'channels'     => ['card', 'mobile_money'],
            'callback_url' => $callbackUrl,
            'metadata'     => $metadata,
        ]);

        $ch = curl_init('https://api.paystack.co/transaction/initialize');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $secret,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode((string) $response, true);
        if ($httpCode >= 400 || !is_array($data) || empty($data['status']) || empty($data['data']['authorization_url'])) {
            $msg = is_array($data) && isset($data['message']) ? (string) $data['message'] : 'Payment initialization failed.';
            throw new \RuntimeException($msg);
        }

        $ref = (string) $data['data']['reference'];
        self::insertPendingPayment($pdo, $ref, $amountGhs, $paymentType, $shopId, $applicationId);

        return [
            'dev_mock'          => false,
            'reference'         => $ref,
            'authorization_url' => (string) $data['data']['authorization_url'],
            'amount_ghs'        => $amountGhs,
        ];
    }

    private static function insertPendingPayment(
        PDO $pdo,
        string $ref,
        float $amountGhs,
        string $paymentType,
        ?int $shopId,
        ?int $applicationId
    ): void {
        $pdo->prepare(
            'INSERT INTO shop_billing_payments (shop_id, application_id, payment_type, amount_ghs, paystack_ref, status)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([$shopId, $applicationId, $paymentType, $amountGhs, $ref, 'pending']);
    }
}
