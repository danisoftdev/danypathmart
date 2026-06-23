<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class PosLocationService
{
    /** @return list<array<string,mixed>> */
    public static function list(PDO $pdo, bool $activeOnly = false): array
    {
        $sql = 'SELECT * FROM pos_locations';
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY name ASC';

        return array_map([self::class, 'format'], $pdo->query($sql)->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function find(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM pos_locations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Location name is required.');
        }

        $pdo->prepare(
            'INSERT INTO pos_locations (name, address, momo_number, pickup_station_id, latitude, longitude, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $name,
            self::nullable($input['address'] ?? null),
            self::nullable($input['momo_number'] ?? null),
            isset($input['pickup_station_id']) && (int) $input['pickup_station_id'] > 0
                ? (int) $input['pickup_station_id'] : null,
            LocationHelper::parseCoordinate($input['latitude'] ?? null),
            LocationHelper::parseCoordinate($input['longitude'] ?? null),
            !empty($input['is_active']) ? 1 : 0,
        ]);

        return self::find($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::find($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Location not found.');
        }

        $name = trim((string) ($input['name'] ?? $existing['name']));
        if ($name === '') {
            throw new \InvalidArgumentException('Location name is required.');
        }

        $pdo->prepare(
            'UPDATE pos_locations SET
                name = ?, address = ?, momo_number = ?, pickup_station_id = ?,
                latitude = ?, longitude = ?, is_active = ?
             WHERE id = ?'
        )->execute([
            $name,
            self::nullable($input['address'] ?? $existing['address']),
            self::nullable($input['momo_number'] ?? $existing['momo_number']),
            isset($input['pickup_station_id']) && (int) $input['pickup_station_id'] > 0
                ? (int) $input['pickup_station_id'] : null,
            array_key_exists('latitude', $input) || array_key_exists('longitude', $input)
                ? LocationHelper::parseLatLng($input)['latitude']
                : $existing['latitude'],
            array_key_exists('latitude', $input) || array_key_exists('longitude', $input)
                ? LocationHelper::parseLatLng($input)['longitude']
                : $existing['longitude'],
            array_key_exists('is_active', $input)
                ? (!empty($input['is_active']) ? 1 : 0)
                : ($existing['is_active'] ? 1 : 0),
            $id,
        ]);

        return self::find($pdo, $id) ?? [];
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'                => (int) $row['id'],
            'name'              => (string) $row['name'],
            'address'           => $row['address'],
            'momo_number'       => $row['momo_number'],
            'pickup_station_id' => isset($row['pickup_station_id']) && $row['pickup_station_id'] !== null
                ? (int) $row['pickup_station_id'] : null,
            'latitude'          => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude'         => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'is_active'         => (int) ($row['is_active'] ?? 0) === 1,
            'created_at'        => $row['created_at'] ?? null,
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
