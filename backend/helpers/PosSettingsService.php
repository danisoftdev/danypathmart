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
        ];

        try {
            $row = $pdo->query(
                'SELECT pos_module_enabled, pos_max_cashier_discount_percent, pos_receipt_footer,
                        pos_void_window_minutes, pos_central_momo, company_name, phone
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
        ];
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
