<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class PosSettingsService
{
    /** @return array<string,mixed> */
    public static function load(PDO $pdo): array
    {
        $defaults = [
            'pos_module_enabled'              => false,
            'pos_max_cashier_discount_percent'=> 10.0,
            'pos_receipt_footer'              => null,
            'pos_void_window_minutes'         => 30,
            'pos_central_momo'                => null,
            'has_supervisor_pin'              => false,
        ];

        try {
            $row = $pdo->query(
                'SELECT pos_module_enabled, pos_max_cashier_discount_percent, pos_receipt_footer,
                        pos_void_window_minutes, pos_central_momo, pos_supervisor_pin_hash,
                        company_name, phone
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        return [
            'pos_module_enabled'               => (int) ($row['pos_module_enabled'] ?? 0) === 1,
            'pos_max_cashier_discount_percent' => round((float) ($row['pos_max_cashier_discount_percent'] ?? 10), 2),
            'pos_receipt_footer'               => $row['pos_receipt_footer'] ?? null,
            'pos_void_window_minutes'          => max(1, (int) ($row['pos_void_window_minutes'] ?? 30)),
            'pos_central_momo'                 => $row['pos_central_momo'] ?? null,
            'company_name'                     => $row['company_name'] ?? 'DanyPathMart',
            'company_phone'                    => $row['phone'] ?? null,
            'has_supervisor_pin'               => !empty($row['pos_supervisor_pin_hash']),
        ];
    }

    public static function verifySupervisorPin(PDO $pdo, ?string $pin): bool
    {
        if ($pin === null || trim($pin) === '') {
            return false;
        }
        try {
            $hash = $pdo->query('SELECT pos_supervisor_pin_hash FROM company_settings ORDER BY id ASC LIMIT 1')->fetchColumn();
        } catch (\Throwable) {
            return false;
        }
        if ($hash === false || $hash === null || $hash === '') {
            return false;
        }

        return password_verify(trim($pin), (string) $hash);
    }

    public static function setSupervisorPin(PDO $pdo, ?string $pin): void
    {
        $hash = null;
        if ($pin !== null && trim($pin) !== '') {
            $hash = password_hash(trim($pin), PASSWORD_DEFAULT);
        }
        try {
            $pdo->prepare('UPDATE company_settings SET pos_supervisor_pin_hash = ? WHERE id = 1')->execute([$hash]);
        } catch (\Throwable $e) {
            throw new \RuntimeException('POS settings require migration 058.');
        }
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, array $input): array
    {
        $current = self::load($pdo);
        $enabled = array_key_exists('pos_module_enabled', $input)
            ? (!empty($input['pos_module_enabled']) ? 1 : 0)
            : ($current['pos_module_enabled'] ? 1 : 0);
        $maxDisc = array_key_exists('pos_max_cashier_discount_percent', $input)
            ? max(0.0, min(100.0, round((float) $input['pos_max_cashier_discount_percent'], 2)))
            : $current['pos_max_cashier_discount_percent'];
        $footer = array_key_exists('pos_receipt_footer', $input)
            ? self::nullableStr($input['pos_receipt_footer'])
            : $current['pos_receipt_footer'];
        $voidMins = array_key_exists('pos_void_window_minutes', $input)
            ? max(1, (int) $input['pos_void_window_minutes'])
            : $current['pos_void_window_minutes'];
        $momo = array_key_exists('pos_central_momo', $input)
            ? self::nullableStr($input['pos_central_momo'])
            : $current['pos_central_momo'];

        if (array_key_exists('pos_supervisor_pin', $input)) {
            self::setSupervisorPin($pdo, self::nullableStr($input['pos_supervisor_pin']));
        }

        try {
            $pdo->prepare(
                'UPDATE company_settings SET
                    pos_module_enabled = ?,
                    pos_max_cashier_discount_percent = ?,
                    pos_receipt_footer = ?,
                    pos_void_window_minutes = ?,
                    pos_central_momo = ?
                 WHERE id = 1'
            )->execute([$enabled, $maxDisc, $footer, $voidMins, $momo]);
        } catch (\Throwable $e) {
            throw new \RuntimeException('POS settings require migration 057.');
        }

        return self::load($pdo);
    }

    private static function nullableStr(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }
}
