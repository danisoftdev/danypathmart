<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Reads/writes the flash-deals banner settings on the company_settings row. */
final class FlashSaleSettings
{
    /**
     * @return array<string,mixed>
     */
    public static function defaults(): array
    {
        return [
            'enabled'  => true,
            'title'    => 'Flash deals',
            'subtitle' => 'Limited picks — ends soon',
            'ends_at'  => null,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public static function read(PDO $pdo): array
    {
        $row = $pdo->query(
            'SELECT flash_sale_enabled, flash_sale_title, flash_sale_subtitle, flash_sale_ends_at
             FROM company_settings ORDER BY id ASC LIMIT 1'
        )->fetch();

        if ($row === false) {
            return self::defaults();
        }

        return [
            'enabled'  => (bool) ($row['flash_sale_enabled'] ?? 1),
            'title'    => (string) ($row['flash_sale_title'] ?? 'Flash deals'),
            'subtitle' => $row['flash_sale_subtitle'] ?? 'Limited picks — ends soon',
            'ends_at'  => $row['flash_sale_ends_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    public static function validate(array $body): array
    {
        $title = trim((string) ($body['title'] ?? ''));
        if ($title === '') {
            Response::error('Flash sale title is required.', 422);
        }

        $endsAt = trim((string) ($body['ends_at'] ?? ''));
        if ($endsAt !== '') {
            $ts = strtotime($endsAt);
            if ($ts === false) {
                Response::error('Flash sale end time is invalid.', 422);
            }
            $endsAt = date('Y-m-d H:i:s', $ts);
        } else {
            $endsAt = null;
        }

        return [
            'enabled'  => !empty($body['enabled']) ? 1 : 0,
            'title'    => $title,
            'subtitle' => trim((string) ($body['subtitle'] ?? '')) ?: null,
            'ends_at'  => $endsAt,
        ];
    }

    /**
     * @param array<string,mixed> $fields
     */
    public static function save(PDO $pdo, array $fields, int $updatedBy): void
    {
        $exists = (int) $pdo->query('SELECT COUNT(*) FROM company_settings')->fetchColumn() > 0;
        if (!$exists) {
            $pdo->prepare(
                'INSERT INTO company_settings (company_name, flash_sale_enabled, flash_sale_title,
                 flash_sale_subtitle, flash_sale_ends_at, updated_by)
                 VALUES (\'DanyPathMart\', ?, ?, ?, ?, ?)'
            )->execute([
                $fields['enabled'],
                $fields['title'],
                $fields['subtitle'],
                $fields['ends_at'],
                $updatedBy,
            ]);
            return;
        }

        $pdo->prepare(
            'UPDATE company_settings SET
                flash_sale_enabled = ?,
                flash_sale_title = ?,
                flash_sale_subtitle = ?,
                flash_sale_ends_at = ?,
                updated_by = ?
             ORDER BY id ASC LIMIT 1'
        )->execute([
            $fields['enabled'],
            $fields['title'],
            $fields['subtitle'],
            $fields['ends_at'],
            $updatedBy,
        ]);
    }
}
