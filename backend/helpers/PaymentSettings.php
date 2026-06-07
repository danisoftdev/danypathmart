<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Payment method toggles stored on company_settings (single row). */
final class PaymentSettings
{
    /**
     * @return array{
     *   paystack_enabled:bool,
     *   wallet_checkout_enabled:bool,
     *   bank_transfer_enabled:bool,
     *   pod_enabled:bool,
     *   pay_before_delivery:bool
     * }
     */
    public static function get(PDO $pdo): array
    {
        $defaults = [
            'paystack_enabled'          => true,
            'wallet_checkout_enabled'   => false,
            'bank_transfer_enabled'     => false,
            'pod_enabled'               => false,
            'pay_before_delivery'       => true,
        ];

        try {
            $row = $pdo->query(
                'SELECT paystack_enabled, wallet_checkout_enabled, bank_transfer_enabled,
                        pod_enabled, pay_before_delivery
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        return [
            'paystack_enabled'        => (bool) ($row['paystack_enabled'] ?? 1),
            'wallet_checkout_enabled' => (bool) ($row['wallet_checkout_enabled'] ?? 0),
            'bank_transfer_enabled'   => (bool) ($row['bank_transfer_enabled'] ?? 0),
            'pod_enabled'             => (bool) ($row['pod_enabled'] ?? 0),
            'pay_before_delivery'     => (bool) ($row['pay_before_delivery'] ?? 1),
        ];
    }

    /** @return array<int,string> */
    public static function enabledMethodLabels(PDO $pdo): array
    {
        $s = self::get($pdo);
        $methods = [];
        if ($s['paystack_enabled']) {
            $methods[] = 'paystack';
        }
        if ($s['wallet_checkout_enabled']) {
            $methods[] = 'wallet';
        }
        if ($s['bank_transfer_enabled']) {
            $methods[] = 'bank_transfer';
        }
        if ($s['pod_enabled']) {
            $methods[] = 'pod';
        }

        return $methods;
    }

    /**
     * Bank details shown to customers when paying by transfer.
     *
     * @return array{bank_name:?string,bank_account_name:?string,bank_account_number:?string}
     */
    public static function bankDetails(PDO $pdo): array
    {
        $empty = [
            'bank_name'            => null,
            'bank_account_name'    => null,
            'bank_account_number'  => null,
        ];

        try {
            $row = $pdo->query(
                'SELECT bank_name, bank_account_name, bank_account_number
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $empty;
        }

        if ($row === false) {
            return $empty;
        }

        return [
            'bank_name'           => self::nullableString($row['bank_name'] ?? null),
            'bank_account_name'   => self::nullableString($row['bank_account_name'] ?? null),
            'bank_account_number' => self::nullableString($row['bank_account_number'] ?? null),
        ];
    }

    public static function assertMethodEnabled(PDO $pdo, string $method): void
    {
        $enabled = self::enabledMethodLabels($pdo);
        $map = [
            'paystack'        => 'paystack',
            'wallet'          => 'wallet',
            'wallet_paystack' => 'wallet', // split uses wallet + paystack toggles
            'bank_transfer'   => 'bank_transfer',
            'pod'             => 'pod',
        ];
        $key = $map[$method] ?? $method;
        if ($method === 'wallet_paystack') {
            if (!in_array('wallet', $enabled, true) || !in_array('paystack', $enabled, true)) {
                Response::error('Wallet + Paystack checkout is not available.', 503, ['code' => 'method_disabled']);
            }
            return;
        }
        if (!in_array($key, $enabled, true)) {
            Response::error('This payment method is not available.', 503, ['code' => 'method_disabled']);
        }
    }

    private static function nullableString(mixed $value): ?string
    {
        $v = trim((string) ($value ?? ''));
        return $v !== '' ? $v : null;
    }
}
