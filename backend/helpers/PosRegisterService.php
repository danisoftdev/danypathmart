<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class PosRegisterService
{
    /** @return list<array<string,mixed>> */
    public static function list(PDO $pdo, ?int $locationId = null, bool $activeOnly = false): array
    {
        $sql = 'SELECT r.*, l.name AS location_name
                FROM pos_registers r
                INNER JOIN pos_locations l ON l.id = r.location_id';
        $params = [];
        $where = [];
        if ($locationId !== null && $locationId > 0) {
            $where[] = 'r.location_id = ?';
            $params[] = $locationId;
        }
        if ($activeOnly) {
            $where[] = 'r.is_active = 1 AND l.is_active = 1';
        }
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY l.name ASC, r.name ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function find(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT r.*, l.name AS location_name
             FROM pos_registers r
             INNER JOIN pos_locations l ON l.id = r.location_id
             WHERE r.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    public static function resolveMomo(PDO $pdo, int $registerId): ?string
    {
        $reg = self::find($pdo, $registerId);
        if ($reg === null) {
            return null;
        }
        if (!empty($reg['momo_number'])) {
            return (string) $reg['momo_number'];
        }
        $loc = PosLocationService::find($pdo, (int) $reg['location_id']);
        if ($loc !== null && !empty($loc['momo_number'])) {
            return (string) $loc['momo_number'];
        }
        $settings = PosSettingsService::load($pdo);

        return $settings['pos_central_momo'] ?? $settings['company_phone'] ?? null;
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input): array
    {
        $locationId = (int) ($input['location_id'] ?? 0);
        $name = trim((string) ($input['name'] ?? ''));
        $code = self::slugCode(trim((string) ($input['code'] ?? $name)));
        if ($locationId <= 0 || $name === '' || $code === '') {
            throw new \InvalidArgumentException('Location, name, and code are required.');
        }
        if (PosLocationService::find($pdo, $locationId) === null) {
            throw new \InvalidArgumentException('Location not found.');
        }

        $pdo->prepare(
            'INSERT INTO pos_registers (location_id, name, code, momo_number, is_active)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $locationId,
            $name,
            self::uniqueCode($pdo, $code),
            self::nullable($input['momo_number'] ?? null),
            !array_key_exists('is_active', $input) || !empty($input['is_active']) ? 1 : 0,
        ]);

        return self::find($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::find($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Register not found.');
        }

        $name = trim((string) ($input['name'] ?? $existing['name']));
        $code = self::slugCode(trim((string) ($input['code'] ?? $existing['code'])));

        $pdo->prepare(
            'UPDATE pos_registers SET name = ?, code = ?, momo_number = ?, is_active = ? WHERE id = ?'
        )->execute([
            $name,
            self::uniqueCode($pdo, $code, $id),
            self::nullable($input['momo_number'] ?? $existing['momo_number']),
            array_key_exists('is_active', $input)
                ? (!empty($input['is_active']) ? 1 : 0)
                : ($existing['is_active'] ? 1 : 0),
            $id,
        ]);

        return self::find($pdo, $id) ?? [];
    }

    private static function slugCode(string $value): string
    {
        $slug = strtolower($value);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'register';
    }

    private static function uniqueCode(PDO $pdo, string $base, ?int $excludeId = null): string
    {
        $code = $base;
        $n = 1;
        while (true) {
            $sql = 'SELECT id FROM pos_registers WHERE code = ?';
            $params = [$code];
            if ($excludeId !== null) {
                $sql .= ' AND id != ?';
                $params[] = $excludeId;
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            if ($stmt->fetch() === false) {
                return $code;
            }
            $code = $base . '-' . $n;
            $n++;
        }
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'location_id'   => (int) $row['location_id'],
            'location_name' => $row['location_name'] ?? null,
            'name'          => (string) $row['name'],
            'code'          => (string) $row['code'],
            'momo_number'   => $row['momo_number'],
            'is_active'     => (int) ($row['is_active'] ?? 0) === 1,
            'created_at'    => $row['created_at'] ?? null,
        ];
    }

    private static function nullable(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }
}
