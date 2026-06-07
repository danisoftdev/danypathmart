<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Pickup points where customers collect orders (Phase M3). */
final class PickupStationService
{
    public const TYPES = ['owned', 'partner', 'club', 'church'];

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo, bool $activeOnly = false): array
    {
        $sql = 'SELECT * FROM pickup_stations';
        if ($activeOnly) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY region ASC, city ASC, name ASC';

        return array_map([self::class, 'formatRow'], $pdo->query($sql)->fetchAll());
    }

    /**
     * @return list<array<string,mixed>>
     */
    public static function listPublic(PDO $pdo, ?string $region = null, ?string $city = null): array
    {
        $sql = 'SELECT * FROM pickup_stations WHERE is_active = 1';
        $params = [];
        if ($region !== null && trim($region) !== '') {
            $sql .= ' AND region = ?';
            $params[] = trim($region);
        }
        if ($city !== null && trim($city) !== '') {
            $sql .= ' AND city = ?';
            $params[] = trim($city);
        }
        $sql .= ' ORDER BY city ASC, name ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'formatPublicRow'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findActive(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM pickup_stations WHERE id = ? AND is_active = 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM pickup_stations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRow($row);
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function create(PDO $pdo, array $input): array
    {
        $data = self::validateInput($input);
        $slug = self::uniqueSlug($pdo, $data['slug']);

        $pdo->prepare(
            'INSERT INTO pickup_stations
                (name, slug, station_type, region, city, street_address, landmark, phone, hours,
                 latitude, longitude, pickup_handling_fee, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $data['name'],
            $slug,
            $data['station_type'],
            $data['region'],
            $data['city'],
            $data['street_address'],
            $data['landmark'],
            $data['phone'],
            $data['hours'],
            $data['latitude'],
            $data['longitude'],
            $data['pickup_handling_fee'],
            $data['is_active'],
        ]);

        $id = (int) $pdo->lastInsertId();
        $row = self::findById($pdo, $id);

        return $row ?? [];
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Pickup station not found.');
        }

        $data = self::validateInput(array_merge($existing, $input));
        $slug = self::uniqueSlug($pdo, $data['slug'], $id);

        $pdo->prepare(
            'UPDATE pickup_stations SET
                name = ?, slug = ?, station_type = ?, region = ?, city = ?,
                street_address = ?, landmark = ?, phone = ?, hours = ?,
                latitude = ?, longitude = ?, pickup_handling_fee = ?, is_active = ?
             WHERE id = ?'
        )->execute([
            $data['name'],
            $slug,
            $data['station_type'],
            $data['region'],
            $data['city'],
            $data['street_address'],
            $data['landmark'],
            $data['phone'],
            $data['hours'],
            $data['latitude'],
            $data['longitude'],
            $data['pickup_handling_fee'],
            $data['is_active'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE pickup_station_id = ?');
        $stmt->execute([$id]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw new \InvalidArgumentException('Cannot delete — orders are linked to this station. Deactivate it instead.');
        }

        $pdo->prepare('DELETE FROM pickup_stations WHERE id = ?')->execute([$id]);
    }

    /** @return array<string,mixed> */
    public static function buildSnapshot(array $station): array
    {
        return [
            'id'                   => (int) ($station['id'] ?? 0),
            'name'                 => (string) ($station['name'] ?? ''),
            'slug'                 => (string) ($station['slug'] ?? ''),
            'station_type'         => (string) ($station['station_type'] ?? 'owned'),
            'region'               => (string) ($station['region'] ?? ''),
            'city'                 => (string) ($station['city'] ?? ''),
            'street_address'       => (string) ($station['street_address'] ?? ''),
            'landmark'             => $station['landmark'] ?? null,
            'phone'                => $station['phone'] ?? null,
            'hours'                => $station['hours'] ?? null,
            'latitude'             => isset($station['latitude']) ? (float) $station['latitude'] : null,
            'longitude'            => isset($station['longitude']) ? (float) $station['longitude'] : null,
            'pickup_handling_fee'  => round((float) ($station['pickup_handling_fee'] ?? 0), 2),
        ];
    }

    /** @param array<string,mixed> $input */
    private static function validateInput(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Station name is required.');
        }

        $region = trim((string) ($input['region'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));
        $street = trim((string) ($input['street_address'] ?? ''));
        if ($region === '' || $city === '' || $street === '') {
            throw new \InvalidArgumentException('Region, city, and street address are required.');
        }

        $type = strtolower(trim((string) ($input['station_type'] ?? 'owned')));
        if (!in_array($type, self::TYPES, true)) {
            throw new \InvalidArgumentException('Invalid station type.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = self::slugify($name);
        } else {
            $slug = self::slugify($slug);
        }

        $lat = $input['latitude'] ?? null;
        $lng = $input['longitude'] ?? null;

        return [
            'name'                  => $name,
            'slug'                  => $slug,
            'station_type'          => $type,
            'region'                => $region,
            'city'                  => $city,
            'street_address'        => $street,
            'landmark'              => self::nullableString($input['landmark'] ?? null),
            'phone'                 => self::nullableString($input['phone'] ?? null),
            'hours'                 => self::nullableString($input['hours'] ?? null),
            'latitude'              => $lat !== null && $lat !== '' ? round((float) $lat, 7) : null,
            'longitude'             => $lng !== null && $lng !== '' ? round((float) $lng, 7) : null,
            'pickup_handling_fee'   => max(0, round((float) ($input['pickup_handling_fee'] ?? 0), 2)),
            'is_active'             => !empty($input['is_active']) ? 1 : 0,
        ];
    }

    private static function slugify(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'station';
    }

    private static function uniqueSlug(PDO $pdo, string $base, ?int $excludeId = null): string
    {
        $slug = $base;
        $n = 1;
        while (true) {
            $sql = 'SELECT id FROM pickup_stations WHERE slug = ?';
            $params = [$slug];
            if ($excludeId !== null) {
                $sql .= ' AND id != ?';
                $params[] = $excludeId;
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            if ($stmt->fetch() === false) {
                return $slug;
            }
            $slug = $base . '-' . $n;
            $n++;
        }
    }

    private static function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    /** @param array<string,mixed> $row */
    private static function formatRow(array $row): array
    {
        return [
            'id'                   => (int) $row['id'],
            'name'                 => $row['name'],
            'slug'                 => $row['slug'],
            'station_type'         => $row['station_type'],
            'region'               => $row['region'],
            'city'                 => $row['city'],
            'street_address'       => $row['street_address'],
            'landmark'             => $row['landmark'],
            'phone'                => $row['phone'],
            'hours'                => $row['hours'],
            'latitude'             => $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude'            => $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'pickup_handling_fee'  => round((float) $row['pickup_handling_fee'], 2),
            'is_active'            => (bool) $row['is_active'],
            'created_at'           => $row['created_at'],
            'updated_at'           => $row['updated_at'],
        ];
    }

    /** @param array<string,mixed> $row */
    private static function formatPublicRow(array $row): array
    {
        $formatted = self::formatRow($row);
        unset($formatted['created_at'], $formatted['updated_at'], $formatted['is_active']);

        return $formatted;
    }
}
