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
            'shop_billing_enabled'              => false,
            'shop_registration_fee_ghs'         => 0.0,
            'shop_renewal_fee_ghs'              => 0.0,
            'shop_renewal_fee_monthly_ghs'      => 0.0,
            'shop_renewal_fee_yearly_ghs'       => 0.0,
            'shop_renewal_period'               => 'yearly',
            'shop_renewal_grace_days'           => 0,
            'shop_new_shop_free_month_enabled'  => false,
            'shop_registration_free_until'    => null,
            'shop_first_reg_discount_enabled'   => false,
            'shop_first_reg_discount_type'      => 'fixed',
            'shop_first_reg_discount_value'     => 0.0,
            'shop_referral_reg_discount_enabled' => false,
            'shop_referral_reg_discount_type'   => 'percent',
            'shop_referral_reg_discount_value'  => 0.0,
            'paystack_fee_mode'                => 'absorb',
            'paystack_fee_percent'             => 1.95,
            'paystack_fee_flat_ghs'            => 0.0,
            'paystack_fee_note'                => null,
        ];

        try {
            $row = $pdo->query(
                'SELECT shop_billing_enabled, shop_registration_fee_ghs, shop_renewal_fee_ghs,
                        shop_renewal_fee_monthly_ghs, shop_renewal_fee_yearly_ghs,
                        shop_renewal_period, shop_renewal_grace_days, shop_new_shop_free_month_enabled,
                        shop_registration_free_until,
                        shop_first_reg_discount_enabled, shop_first_reg_discount_type, shop_first_reg_discount_value,
                        shop_referral_reg_discount_enabled, shop_referral_reg_discount_type, shop_referral_reg_discount_value,
                        paystack_fee_mode, paystack_fee_percent, paystack_fee_flat_ghs, paystack_fee_note
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            try {
                $row = $pdo->query(
                    'SELECT shop_billing_enabled, shop_registration_fee_ghs, shop_renewal_fee_ghs,
                            shop_renewal_fee_monthly_ghs, shop_renewal_fee_yearly_ghs,
                            shop_renewal_period, shop_renewal_grace_days, shop_new_shop_free_month_enabled,
                            shop_registration_free_until,
                            shop_first_reg_discount_enabled, shop_first_reg_discount_type, shop_first_reg_discount_value,
                            shop_referral_reg_discount_enabled, shop_referral_reg_discount_type, shop_referral_reg_discount_value
                     FROM company_settings ORDER BY id ASC LIMIT 1'
                )->fetch();
            } catch (\Throwable) {
                try {
                    $row = $pdo->query(
                        'SELECT shop_billing_enabled, shop_registration_fee_ghs, shop_renewal_fee_ghs,
                                shop_renewal_period, shop_renewal_grace_days,
                                shop_registration_free_until,
                                shop_first_reg_discount_enabled, shop_first_reg_discount_type, shop_first_reg_discount_value,
                                shop_referral_reg_discount_enabled, shop_referral_reg_discount_type, shop_referral_reg_discount_value
                         FROM company_settings ORDER BY id ASC LIMIT 1'
                    )->fetch();
                } catch (\Throwable) {
                    return $defaults;
                }
            }
        }

        if ($row === false) {
            return $defaults;
        }

        $period = (string) ($row['shop_renewal_period'] ?? 'yearly');
        if (!in_array($period, ['monthly', 'yearly'], true)) {
            $period = 'yearly';
        }

        $legacyFee = max(0.0, (float) ($row['shop_renewal_fee_ghs'] ?? 0));
        $monthly = array_key_exists('shop_renewal_fee_monthly_ghs', $row)
            ? max(0.0, (float) $row['shop_renewal_fee_monthly_ghs'])
            : ($period === 'monthly' ? $legacyFee : 0.0);
        $yearly = array_key_exists('shop_renewal_fee_yearly_ghs', $row)
            ? max(0.0, (float) $row['shop_renewal_fee_yearly_ghs'])
            : ($period === 'yearly' ? $legacyFee : 0.0);

        // If new columns exist but are both 0 and legacy fee is set, map legacy once.
        if ($monthly <= 0 && $yearly <= 0 && $legacyFee > 0) {
            if ($period === 'monthly') {
                $monthly = $legacyFee;
            } else {
                $yearly = $legacyFee;
            }
        }

        $legacyCompat = $period === 'monthly' ? $monthly : $yearly;
        if ($legacyCompat <= 0) {
            $legacyCompat = max($monthly, $yearly);
        }

        return [
            'shop_billing_enabled'              => (int) ($row['shop_billing_enabled'] ?? 0) === 1,
            'shop_registration_fee_ghs'         => max(0.0, (float) ($row['shop_registration_fee_ghs'] ?? 0)),
            'shop_renewal_fee_ghs'              => $legacyCompat,
            'shop_renewal_fee_monthly_ghs'      => $monthly,
            'shop_renewal_fee_yearly_ghs'       => $yearly,
            'shop_renewal_period'               => $period,
            'shop_renewal_grace_days'           => 0,
            'shop_new_shop_free_month_enabled'  => (int) ($row['shop_new_shop_free_month_enabled'] ?? 0) === 1,
            'shop_registration_free_until'      => $row['shop_registration_free_until'] ?? null,
            'shop_first_reg_discount_enabled'   => (int) ($row['shop_first_reg_discount_enabled'] ?? 0) === 1,
            'shop_first_reg_discount_type'      => ($row['shop_first_reg_discount_type'] ?? 'fixed') === 'percent' ? 'percent' : 'fixed',
            'shop_first_reg_discount_value'     => max(0.0, (float) ($row['shop_first_reg_discount_value'] ?? 0)),
            'shop_referral_reg_discount_enabled' => (int) ($row['shop_referral_reg_discount_enabled'] ?? 0) === 1,
            'shop_referral_reg_discount_type'   => ($row['shop_referral_reg_discount_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
            'shop_referral_reg_discount_value'  => max(0.0, (float) ($row['shop_referral_reg_discount_value'] ?? 0)),
            'paystack_fee_mode'                => (($row['paystack_fee_mode'] ?? 'absorb') === 'pass_to_payer') ? 'pass_to_payer' : 'absorb',
            'paystack_fee_percent'             => max(0.0, (float) ($row['paystack_fee_percent'] ?? 1.95)),
            'paystack_fee_flat_ghs'            => max(0.0, (float) ($row['paystack_fee_flat_ghs'] ?? 0)),
            'paystack_fee_note'                => isset($row['paystack_fee_note']) && $row['paystack_fee_note'] !== ''
                ? (string) $row['paystack_fee_note'] : null,
        ];
    }

    /** @return list<array{period:string,fee:float,label:string}> */
    public static function renewalOptions(array $settings): array
    {
        $options = [];
        $monthly = max(0.0, (float) ($settings['shop_renewal_fee_monthly_ghs'] ?? 0));
        $yearly = max(0.0, (float) ($settings['shop_renewal_fee_yearly_ghs'] ?? 0));
        if ($monthly > 0) {
            $options[] = ['period' => 'monthly', 'fee' => $monthly, 'label' => 'Monthly'];
        }
        if ($yearly > 0) {
            $options[] = ['period' => 'yearly', 'fee' => $yearly, 'label' => 'Yearly'];
        }

        return $options;
    }

    public static function renewalFeeForPeriod(array $settings, string $period): float
    {
        $period = self::normalizePeriod($period, $settings);

        return $period === 'monthly'
            ? max(0.0, (float) ($settings['shop_renewal_fee_monthly_ghs'] ?? 0))
            : max(0.0, (float) ($settings['shop_renewal_fee_yearly_ghs'] ?? 0));
    }

    public static function normalizePeriod(?string $period, ?array $settings = null): string
    {
        $period = strtolower(trim((string) ($period ?? '')));
        if (in_array($period, ['monthly', 'yearly'], true)) {
            return $period;
        }
        $fallback = (string) (($settings ?? [])['shop_renewal_period'] ?? 'yearly');

        return $fallback === 'monthly' ? 'monthly' : 'yearly';
    }

    /** Prefer requested period if it has a fee; else first available paid option; else default. */
    public static function resolveRenewalPeriod(array $settings, ?string $requested = null): string
    {
        $options = self::renewalOptions($settings);
        $requested = $requested !== null ? self::normalizePeriod($requested, $settings) : null;

        foreach ($options as $opt) {
            if ($requested !== null && $opt['period'] === $requested) {
                return $requested;
            }
        }
        if ($options !== []) {
            $default = self::normalizePeriod((string) ($settings['shop_renewal_period'] ?? 'yearly'), $settings);
            foreach ($options as $opt) {
                if ($opt['period'] === $default) {
                    return $default;
                }
            }

            return (string) $options[0]['period'];
        }

        return self::normalizePeriod((string) ($settings['shop_renewal_period'] ?? 'yearly'), $settings);
    }

    public static function isRegistrationFreePeriodActive(array $settings): bool
    {
        $until = $settings['shop_registration_free_until'] ?? null;
        if ($until === null || trim((string) $until) === '') {
            return false;
        }

        return date('Y-m-d') <= (string) $until;
    }

    public static function applicantHasPriorRegistration(PDO $pdo, ?int $userId, ?string $email): bool
    {
        $email = $email !== null ? strtolower(trim($email)) : '';
        if ($email === '' && ($userId === null || $userId <= 0)) {
            return false;
        }

        $sql = 'SELECT 1 FROM shop_applications WHERE (
                    (? <> "" AND email = ?)
                    OR (? > 0 AND user_id = ?)
                ) AND (
                    status = ?
                    OR registration_fee_paid = 1
                    OR shop_id IS NOT NULL
                ) LIMIT 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $email, $email,
            $userId ?? 0, $userId ?? 0,
            'approved',
        ]);

        return $stmt->fetchColumn() !== false;
    }

    /**
     * @param array{user_id?:int|null,email?:string|null,has_valid_referrer?:bool} $ctx
     * @return array{
     *   list_fee:float,amount_due:float,discount_total:float,requires_payment:bool,
     *   free_period_active:bool,breakdown:list<array{label:string,amount:float}>
     * }
     */
    public static function computeRegistrationPricing(PDO $pdo, array $ctx = []): array
    {
        $settings = self::loadSettings($pdo);
        $listFee = round((float) ($settings['shop_registration_fee_ghs'] ?? 0), 2);
        $breakdown = [];

        if (!$settings['shop_billing_enabled'] || $listFee <= 0) {
            return [
                'list_fee'            => $listFee,
                'amount_due'          => 0.0,
                'discount_total'      => 0.0,
                'requires_payment'    => false,
                'free_period_active'  => false,
                'free_month_active'   => !empty($settings['shop_new_shop_free_month_enabled']),
                'breakdown'           => !empty($settings['shop_new_shop_free_month_enabled'])
                    ? [['label' => 'First month free — no payment required', 'amount' => 0.0]]
                    : [],
            ];
        }

        // Free first-month promo: skip registration payment entirely.
        if (!empty($settings['shop_new_shop_free_month_enabled'])) {
            return [
                'list_fee'            => $listFee,
                'amount_due'          => 0.0,
                'discount_total'      => $listFee,
                'requires_payment'    => false,
                'free_period_active'  => false,
                'free_month_active'   => true,
                'breakdown'           => [['label' => 'First month free — no payment required', 'amount' => $listFee]],
            ];
        }

        if (self::isRegistrationFreePeriodActive($settings)) {
            return [
                'list_fee'            => $listFee,
                'amount_due'          => 0.0,
                'discount_total'      => $listFee,
                'requires_payment'    => false,
                'free_period_active'  => true,
                'free_month_active'   => false,
                'breakdown'           => [['label' => 'Launch promo — free registration', 'amount' => $listFee]],
            ];
        }

        $amount = $listFee;
        $discountTotal = 0.0;

        if (
            !empty($settings['shop_first_reg_discount_enabled'])
            && !self::applicantHasPriorRegistration($pdo, $ctx['user_id'] ?? null, $ctx['email'] ?? null)
        ) {
            $d = self::applyDiscountAmount(
                $amount,
                (string) $settings['shop_first_reg_discount_type'],
                (float) $settings['shop_first_reg_discount_value']
            );
            if ($d > 0) {
                $breakdown[] = ['label' => 'First registration discount', 'amount' => $d];
                $discountTotal += $d;
                $amount -= $d;
            }
        }

        if (!empty($settings['shop_referral_reg_discount_enabled']) && !empty($ctx['has_valid_referrer'])) {
            $d = self::applyDiscountAmount(
                $amount,
                (string) $settings['shop_referral_reg_discount_type'],
                (float) $settings['shop_referral_reg_discount_value']
            );
            if ($d > 0) {
                $breakdown[] = ['label' => 'Referral code discount', 'amount' => $d];
                $discountTotal += $d;
                $amount -= $d;
            }
        }

        $amountDue = max(0.0, round($amount, 2));

        return [
            'list_fee'            => $listFee,
            'amount_due'          => $amountDue,
            'discount_total'      => round($discountTotal, 2),
            'requires_payment'    => $amountDue > 0,
            'free_period_active'  => false,
            'free_month_active'   => false,
            'breakdown'           => $breakdown,
        ];
    }

    public static function applyRegistrationPricingToApplication(PDO $pdo, int $applicationId): void
    {
        $app = ShopApplicationService::findById($pdo, $applicationId);
        if ($app === null) {
            return;
        }

        $hasReferrer = !empty($app['referred_by_type'])
            || !empty($app['referred_by_shop_id'])
            || !empty($app['referred_by_promoter_id']);

        $quote = self::computeRegistrationPricing($pdo, [
            'user_id'            => $app['user_id'],
            'email'              => $app['email'],
            'has_valid_referrer' => $hasReferrer,
        ]);

        $status = $app['status'];
        if ($status === 'pending_payment' && !$quote['requires_payment']) {
            $status = 'new';
        } elseif ($quote['requires_payment'] && $status === 'new') {
            $status = 'pending_payment';
        }

        try {
            $pdo->prepare(
                'UPDATE shop_applications SET
                    registration_list_fee = ?,
                    registration_discount_amount = ?,
                    registration_amount_due = ?,
                    status = ?
                 WHERE id = ?'
            )->execute([
                $quote['list_fee'],
                $quote['discount_total'],
                $quote['amount_due'],
                $status,
                $applicationId,
            ]);
        } catch (\Throwable) {
            if ($status !== $app['status']) {
                $pdo->prepare('UPDATE shop_applications SET status = ? WHERE id = ?')
                    ->execute([$status, $applicationId]);
            }
        }
    }

    private static function applyDiscountAmount(float $current, string $type, float $value): float
    {
        if ($value <= 0 || $current <= 0) {
            return 0.0;
        }
        if ($type === 'percent') {
            return round($current * min(100.0, $value) / 100.0, 2);
        }

        return min($current, round($value, 2));
    }

    public static function registrationAmountDueForApplication(array $app): float
    {
        if (!empty($app['registration_fee_waived']) || !empty($app['registration_fee_paid'])) {
            return 0.0;
        }
        if (isset($app['registration_amount_due']) && $app['registration_amount_due'] !== null) {
            return max(0.0, round((float) $app['registration_amount_due'], 2));
        }

        return 0.0;
    }

    public static function registrationRequired(PDO $pdo, ?array $application = null): bool
    {
        $s = self::loadSettings($pdo);
        if (!$s['shop_billing_enabled'] || $s['shop_registration_fee_ghs'] <= 0) {
            return false;
        }

        if ($application !== null) {
            if (self::applicationRegistrationPaid($application)) {
                return false;
            }

            return self::registrationAmountDueForApplication($application) > 0;
        }

        $quote = self::computeRegistrationPricing($pdo, []);

        return $quote['requires_payment'];
    }

    public static function renewalRequired(PDO $pdo): bool
    {
        $s = self::loadSettings($pdo);
        if (!$s['shop_billing_enabled']) {
            return false;
        }

        return self::renewalOptions($s) !== [];
    }

    /** @return array<string,mixed> */
    public static function publicSettings(PDO $pdo): array
    {
        $s = self::loadSettings($pdo);
        $quote = self::computeRegistrationPricing($pdo, []);
        $options = self::renewalOptions($s);
        $defaultPeriod = self::resolveRenewalPeriod($s, null);
        $defaultFee = self::renewalFeeForPeriod($s, $defaultPeriod);

        return [
            'enabled'                       => $s['shop_billing_enabled'],
            'registration_fee'              => $s['shop_registration_fee_ghs'],
            'registration_amount_due'       => $quote['amount_due'],
            'registration_list_fee'         => $quote['list_fee'],
            'requires_payment'              => !empty($quote['requires_payment']),
            'free_period_active'            => $quote['free_period_active'],
            'free_period_until'             => $s['shop_registration_free_until'],
            'free_month_active'             => !empty($quote['free_month_active']),
            'first_registration_discount'   => [
                'enabled' => $s['shop_first_reg_discount_enabled'],
                'type'    => $s['shop_first_reg_discount_type'],
                'value'   => $s['shop_first_reg_discount_value'],
            ],
            'referral_applicant_discount'   => [
                'enabled' => $s['shop_referral_reg_discount_enabled'],
                'type'    => $s['shop_referral_reg_discount_type'],
                'value'   => $s['shop_referral_reg_discount_value'],
            ],
            'renewal_fee'                   => $defaultFee,
            'renewal_fee_monthly'           => $s['shop_renewal_fee_monthly_ghs'],
            'renewal_fee_yearly'            => $s['shop_renewal_fee_yearly_ghs'],
            'renewal_period'                => $defaultPeriod,
            'renewal_options'               => $options,
            'new_shop_free_month'           => !empty($s['shop_new_shop_free_month_enabled']),
            'paystack_fees'                 => [
                'mode'     => $s['paystack_fee_mode'],
                'percent'  => $s['paystack_fee_percent'],
                'flat_ghs' => $s['paystack_fee_flat_ghs'],
                'note'     => $s['paystack_fee_note'],
            ],
            'currency'                      => 'GHS',
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
    public static function initialApplicationStatus(PDO $pdo, array $ctx = []): array
    {
        $quote = self::computeRegistrationPricing($pdo, $ctx);

        return [
            'requires_payment' => $quote['requires_payment'],
            'status'           => $quote['requires_payment'] ? 'pending_payment' : 'new',
        ];
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

        $amountGhs = self::registrationAmountDueForApplication($app);
        if ($amountGhs <= 0) {
            $quote = self::computeRegistrationPricing($pdo, [
                'user_id'            => $app['user_id'],
                'email'              => $app['email'],
                'has_valid_referrer' => !empty($app['referred_by_type']),
            ]);
            $amountGhs = $quote['amount_due'];
        }

        if ($amountGhs <= 0) {
            $ref = 'FREE-' . $applicationId;
            ShopBillingReceiptService::recordComplimentary(
                $pdo,
                null,
                $applicationId,
                'reg',
                'No payment required — complimentary registration / free first month.',
                (float) ($app['registration_list_fee'] ?? 0),
                $ref
            );
            self::markRegistrationPaid($pdo, $applicationId, $ref);

            return [
                'dev_mock'          => true,
                'reference'         => $ref,
                'authorization_url' => null,
                'amount_ghs'        => 0.0,
                'no_payment_needed' => true,
            ];
        }

        $quote = ShopBillingReceiptService::quoteCharge($pdo, $amountGhs);
        $chargeGhs = $quote['charge_amount_ghs'];

        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $callback = $frontend . '/sell?shop_payment=registration&application_id=' . $applicationId;

        return self::initializePaystack(
            $pdo,
            $email,
            $chargeGhs,
            $callback,
            [
                'billing_type'   => 'shop_registration',
                'application_id' => $applicationId,
            ],
            'registration',
            null,
            $applicationId,
            null,
            $quote
        );
    }

    /**
     * @return array{dev_mock:bool,reference:string,authorization_url:string,amount_ghs:float,period:string}
     */
    public static function initializeRenewalPayment(
        PDO $pdo,
        int $shopId,
        string $email,
        ?string $period = null
    ): array {
        if (!self::renewalRequired($pdo)) {
            throw new \InvalidArgumentException('Shop renewal billing is not enabled (set a monthly and/or yearly fee).');
        }

        $settings = self::loadSettings($pdo);
        $period = self::resolveRenewalPeriod($settings, $period);
        $amountGhs = self::renewalFeeForPeriod($settings, $period);
        if ($amountGhs <= 0) {
            throw new \InvalidArgumentException('That renewal plan is not available (fee is 0). Choose another plan.');
        }

        $quote = ShopBillingReceiptService::quoteCharge($pdo, $amountGhs);
        $chargeGhs = $quote['charge_amount_ghs'];

        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $callback = $frontend . '/seller/billing?shop_payment=renewal';

        $result = self::initializePaystack(
            $pdo,
            $email,
            $chargeGhs,
            $callback,
            [
                'billing_type'    => 'shop_renewal',
                'shop_id'         => $shopId,
                'billing_period'  => $period,
            ],
            'renewal',
            $shopId,
            null,
            $period,
            $quote
        );
        $result['period'] = $period;
        $result['platform_amount_ghs'] = $quote['platform_amount_ghs'];
        $result['processor_fee_ghs'] = $quote['processor_fee_ghs'];
        $result['fee_mode'] = $quote['mode'];

        return $result;
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
                ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, $paystackData);
                self::maybeSaveCardFromPaystack($pdo, null, $appId, $paystackData);

                return true;
            }
        }
        if ($type === 'shop_renewal' || $type === 'shop_card_setup') {
            $shopId = (int) ($meta['shop_id'] ?? 0);
            if ($shopId > 0) {
                if ($type === 'shop_renewal') {
                    $period = isset($meta['billing_period']) ? (string) $meta['billing_period'] : null;
                    self::markRenewalPaid($pdo, $shopId, $reference, $period);
                } else {
                    $pdo->prepare(
                        'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
                    )->execute(['paid', $reference]);
                }
                ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, $paystackData);
                self::maybeSaveCardFromPaystack($pdo, $shopId, null, $paystackData);

                return true;
            }
        }

        $stmt = $pdo->prepare(
            'SELECT id, application_id, shop_id, payment_type, status FROM shop_billing_payments WHERE paystack_ref = ? LIMIT 1'
        );
        $stmt->execute([$reference]);
        $row = $stmt->fetch();
        if ($row === false || $row['status'] === 'paid') {
            return $row !== false;
        }

        if ($row['payment_type'] === 'registration' && $row['application_id']) {
            self::markRegistrationPaid($pdo, (int) $row['application_id'], $reference);
            ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, $paystackData);
            self::maybeSaveCardFromPaystack($pdo, null, (int) $row['application_id'], $paystackData);

            return true;
        }
        if (($row['payment_type'] === 'renewal' || $row['payment_type'] === 'card_setup') && $row['shop_id']) {
            if ($row['payment_type'] === 'renewal') {
                self::markRenewalPaid($pdo, (int) $row['shop_id'], $reference);
            } else {
                $pdo->prepare(
                    'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
                )->execute(['paid', $reference]);
            }
            ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference, $paystackData);
            self::maybeSaveCardFromPaystack($pdo, (int) $row['shop_id'], null, $paystackData);

            return true;
        }

        return false;
    }

    /** @param array<string,mixed> $paystackData */
    private static function maybeSaveCardFromPaystack(
        PDO $pdo,
        ?int $shopId,
        ?int $applicationId,
        array $paystackData
    ): void {
        $auth = $paystackData['authorization'] ?? null;
        if (!is_array($auth)) {
            return;
        }
        $customerCode = null;
        if (isset($paystackData['customer']['customer_code'])) {
            $customerCode = (string) $paystackData['customer']['customer_code'];
        }
        if ($shopId === null && $applicationId !== null) {
            $app = ShopApplicationService::findById($pdo, $applicationId);
            if ($app !== null && !empty($app['shop_id'])) {
                $shopId = (int) $app['shop_id'];
            }
        }
        if ($shopId !== null && $shopId > 0) {
            ShopBillingReceiptService::saveAuthorization($pdo, $shopId, $auth, $customerCode);
        }
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
            $pdo->prepare(
                'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
            )->execute(['paid', $reference]);
        } else {
            $app = ShopApplicationService::findById($pdo, $applicationId);
            if ($app !== null && isset($app['registration_amount_due'])) {
                $amountGhs = (float) $app['registration_amount_due'];
            }
        }

        $pdo->prepare(
            'UPDATE shop_applications SET registration_fee_paid = 1, registration_payment_ref = ?, status = ? WHERE id = ?'
        )->execute([$reference, 'new', $applicationId]);

        if ($amountGhs > 0) {
            SubscriptionReferralService::payOnRegistration($pdo, $applicationId, $amountGhs, $reference);
        }

        $paidApp = ShopApplicationService::findById($pdo, $applicationId);
        if ($paidApp !== null) {
            $paidApp['requires_payment'] = false;
            ShopApplicationService::notifyReviewers($pdo, $paidApp, 'Shop registration paid — ready for review');
        }
    }

    public static function markRenewalPaid(PDO $pdo, int $shopId, string $reference, ?string $period = null): void
    {
        $pdo->prepare(
            'UPDATE shop_billing_payments SET status = ?, paid_at = NOW() WHERE paystack_ref = ?'
        )->execute(['paid', $reference]);
        ShopBillingReceiptService::finalizePaidReceipt($pdo, $reference);

        if ($period === null || $period === '') {
            $period = self::inferPeriodFromPaymentRef($pdo, $reference);
        }

        self::extendSubscription($pdo, $shopId, $period);
        $pdo->prepare('UPDATE shops SET status = ?, is_published = 1 WHERE id = ?')->execute(['active', $shopId]);
    }

    private static function inferPeriodFromPaymentRef(PDO $pdo, string $reference): string
    {
        $settings = self::loadSettings($pdo);
        try {
            $stmt = $pdo->prepare(
                'SELECT amount_ghs, billing_period FROM shop_billing_payments WHERE paystack_ref = ? LIMIT 1'
            );
            $stmt->execute([$reference]);
            $row = $stmt->fetch();
        } catch (\Throwable) {
            $stmt = $pdo->prepare(
                'SELECT amount_ghs FROM shop_billing_payments WHERE paystack_ref = ? LIMIT 1'
            );
            $stmt->execute([$reference]);
            $row = $stmt->fetch();
        }

        if (is_array($row) && !empty($row['billing_period'])) {
            return self::normalizePeriod((string) $row['billing_period'], $settings);
        }

        $amount = is_array($row) ? round((float) ($row['amount_ghs'] ?? 0), 2) : 0.0;
        $monthly = round((float) $settings['shop_renewal_fee_monthly_ghs'], 2);
        $yearly = round((float) $settings['shop_renewal_fee_yearly_ghs'], 2);
        if ($amount > 0 && $monthly > 0 && abs($amount - $monthly) < 0.011) {
            return 'monthly';
        }
        if ($amount > 0 && $yearly > 0 && abs($amount - $yearly) < 0.011) {
            return 'yearly';
        }

        return self::resolveRenewalPeriod($settings, null);
    }

    public static function waiveApplicationRegistration(PDO $pdo, int $applicationId, int $adminUserId, ?string $note = null): void
    {
        $pdo->prepare(
            'UPDATE shop_applications SET registration_fee_waived = 1, status = ?, admin_note = COALESCE(?, admin_note) WHERE id = ? AND status = ?'
        )->execute(['new', $note, $applicationId, 'pending_payment']);

        ShopBillingReceiptService::recordComplimentary(
            $pdo,
            null,
            $applicationId,
            'waive',
            $note !== null && $note !== '' ? 'Admin waiver: ' . $note : 'Registration fee waived by admin.'
        );
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

        ShopBillingReceiptService::recordComplimentary(
            $pdo,
            $shopId,
            null,
            'waive-sub',
            $note !== null && $note !== '' ? 'Subscription waived until ' . $untilDate . ': ' . $note
                : 'Subscription waived until ' . $untilDate . '.'
        );
    }

    public static function createSubscriptionOnApprove(PDO $pdo, int $shopId): void
    {
        if (!self::loadSettings($pdo)['shop_billing_enabled']) {
            return;
        }

        $settings = self::loadSettings($pdo);
        $freeMonth = !empty($settings['shop_new_shop_free_month_enabled']);
        // Free first month for new shops when toggle is on; otherwise use default paid plan length.
        if ($freeMonth) {
            $end = date('Y-m-d', strtotime('+1 month'));
        } else {
            $period = self::resolveRenewalPeriod($settings, null);
            $end = $period === 'monthly'
                ? date('Y-m-d', strtotime('+1 month'))
                : date('Y-m-d', strtotime('+1 year'));
        }

        $pdo->prepare(
            'INSERT INTO shop_subscriptions (shop_id, status, period_start, period_end)
             VALUES (?, ?, CURDATE(), ?)
             ON DUPLICATE KEY UPDATE status = ?, period_start = CURDATE(), period_end = ?, updated_at = NOW()'
        )->execute([$shopId, 'active', $end, 'active', $end]);

        if ($freeMonth) {
            $monthly = (float) $settings['shop_renewal_fee_monthly_ghs'];
            ShopBillingReceiptService::recordComplimentary(
                $pdo,
                $shopId,
                null,
                'month',
                'First month free — no payment required. Coverage until ' . $end . '.',
                $monthly > 0 ? $monthly : (float) $settings['shop_renewal_fee_ghs']
            );
        }
    }

    public static function isShopInGoodStanding(PDO $pdo, int $shopId): bool
    {
        // Same rule as public visibility — no grace period after expiry.
        return self::isShopPubliclyVisible($pdo, $shopId);
    }

    /** Public storefront visibility — no grace period; hidden when subscription lapses. */
    public static function isShopPubliclyVisible(PDO $pdo, int $shopId): bool
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

            return $end !== '' && $end >= date('Y-m-d');
        }

        return false;
    }

    /** Days until subscription period_end (null if billing off or no end date). */
    public static function daysUntilExpiry(PDO $pdo, int $shopId): ?int
    {
        $sub = self::subscriptionForShop($pdo, $shopId);
        if ($sub === null || empty($sub['period_end'])) {
            return null;
        }
        $end = (string) $sub['period_end'];
        $today = date('Y-m-d');

        return (int) floor((strtotime($end) - strtotime($today)) / 86400);
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

    private static function extendSubscription(PDO $pdo, int $shopId, ?string $period = null): void
    {
        $settings = self::loadSettings($pdo);
        $period = self::resolveRenewalPeriod($settings, $period);
        $start = date('Y-m-d');
        $end = $period === 'monthly'
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
     * @param array<string,mixed>|null $feeQuote
     * @return array{dev_mock:bool,reference:string,authorization_url:?string,amount_ghs:float}
     */
    private static function initializePaystack(
        PDO $pdo,
        string $email,
        float $amountGhs,
        string $callbackUrl,
        array $metadata,
        string $paymentType,
        ?int $shopId,
        ?int $applicationId,
        ?string $billingPeriod = null,
        ?array $feeQuote = null
    ): array {
        $amountPesewas = (int) round($amountGhs * 100);
        if ($amountPesewas <= 0) {
            throw new \InvalidArgumentException('Invalid payment amount.');
        }

        $secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
        $configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');

        if (!$configured) {
            $ref = 'SHOP-DEV-' . bin2hex(random_bytes(6));
            self::insertPendingPayment($pdo, $ref, $amountGhs, $paymentType, $shopId, $applicationId, $billingPeriod, $feeQuote);

            return [
                'dev_mock'          => true,
                'reference'         => $ref,
                'authorization_url' => $callbackUrl . (str_contains($callbackUrl, '?') ? '&' : '?')
                    . 'reference=' . urlencode($ref) . '&mock=1',
                'amount_ghs'        => $amountGhs,
            ];
        }

        // Prefer card when saving a method for auto-renew.
        $channels = ($paymentType === 'card_setup') ? ['card'] : ['card', 'mobile_money'];

        $payload = json_encode([
            'email'        => $email,
            'amount'       => $amountPesewas,
            'currency'     => 'GHS',
            'channels'     => $channels,
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
        self::insertPendingPayment($pdo, $ref, $amountGhs, $paymentType, $shopId, $applicationId, $billingPeriod, $feeQuote);

        return [
            'dev_mock'          => false,
            'reference'         => $ref,
            'authorization_url' => (string) $data['data']['authorization_url'],
            'amount_ghs'        => $amountGhs,
        ];
    }

    /**
     * @param array<string,mixed>|null $feeQuote
     */
    public static function insertPendingPaymentPublic(
        PDO $pdo,
        string $ref,
        float $amountGhs,
        string $paymentType,
        ?int $shopId,
        ?int $applicationId,
        ?string $billingPeriod = null,
        ?array $feeQuote = null
    ): void {
        self::insertPendingPayment($pdo, $ref, $amountGhs, $paymentType, $shopId, $applicationId, $billingPeriod, $feeQuote);
    }

    /**
     * Small card authorization charge (refundable product-wise as card setup).
     *
     * @return array{dev_mock:bool,reference:string,authorization_url:?string,amount_ghs:float}
     */
    public static function initializeCardSetup(PDO $pdo, int $shopId, string $email): array
    {
        $amount = 1.0; // GHS 1 authorization / setup charge
        $quote = [
            'mode'                => 'absorb',
            'platform_amount_ghs' => $amount,
            'processor_fee_ghs'   => 0.0,
            'charge_amount_ghs'   => $amount,
        ];
        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $callback = $frontend . '/seller/billing?shop_payment=card_setup';

        return self::initializePaystack(
            $pdo,
            $email,
            $amount,
            $callback,
            [
                'billing_type' => 'shop_card_setup',
                'shop_id'      => $shopId,
            ],
            'card_setup',
            $shopId,
            null,
            null,
            $quote
        );
    }

    /**
     * @param array<string,mixed>|null $feeQuote
     */
    private static function insertPendingPayment(
        PDO $pdo,
        string $ref,
        float $amountGhs,
        string $paymentType,
        ?int $shopId,
        ?int $applicationId,
        ?string $billingPeriod = null,
        ?array $feeQuote = null
    ): void {
        $receipt = ShopBillingReceiptService::nextReceiptNumber($pdo);
        $platform = $feeQuote['platform_amount_ghs'] ?? $amountGhs;
        $processor = $feeQuote['processor_fee_ghs'] ?? 0.0;
        $mode = $feeQuote['mode'] ?? null;
        $notes = null;
        if ($paymentType === 'card_setup') {
            $notes = 'Card setup authorization (GHS 1).';
        }

        try {
            $pdo->prepare(
                'INSERT INTO shop_billing_payments
                    (receipt_number, shop_id, application_id, payment_type, billing_period, amount_ghs,
                     platform_amount_ghs, processor_fee_ghs, fee_mode, is_complimentary, notes, paystack_ref, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)'
            )->execute([
                $receipt,
                $shopId,
                $applicationId,
                $paymentType,
                $billingPeriod,
                $amountGhs,
                $platform,
                $processor,
                $mode,
                $notes,
                $ref,
                'pending',
            ]);
        } catch (\Throwable) {
            try {
                $pdo->prepare(
                    'INSERT INTO shop_billing_payments (shop_id, application_id, payment_type, billing_period, amount_ghs, paystack_ref, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                )->execute([$shopId, $applicationId, $paymentType, $billingPeriod, $amountGhs, $ref, 'pending']);
            } catch (\Throwable) {
                $pdo->prepare(
                    'INSERT INTO shop_billing_payments (shop_id, application_id, payment_type, amount_ghs, paystack_ref, status)
                     VALUES (?, ?, ?, ?, ?, ?)'
                )->execute([$shopId, $applicationId, $paymentType === 'card_setup' ? 'renewal' : $paymentType, $amountGhs, $ref, 'pending']);
            }
        }
    }
}
