<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Size guides per product line + measurement-based size suggestion. */
final class SizeGuideService
{
    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listAll(PDO $pdo): array
    {
        try {
            $rows = $pdo->query(
                'SELECT id, name, notes, created_at, updated_at FROM size_guides ORDER BY name ASC'
            )->fetchAll();
        } catch (\Throwable) {
            return [];
        }

        return array_map(static fn (array $r): array => [
            'id'         => (int) $r['id'],
            'name'       => $r['name'],
            'notes'      => $r['notes'],
            'created_at' => $r['created_at'],
            'updated_at' => $r['updated_at'],
        ], $rows);
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function getById(PDO $pdo, int $id, bool $withRows = true): ?array
    {
        if ($id <= 0) {
            return null;
        }

        try {
            $stmt = $pdo->prepare('SELECT id, name, notes FROM size_guides WHERE id = ?');
            $stmt->execute([$id]);
            $guide = $stmt->fetch();
        } catch (\Throwable) {
            return null;
        }

        if ($guide === false) {
            return null;
        }

        return [
            'id'    => (int) $guide['id'],
            'name'  => $guide['name'],
            'notes' => $guide['notes'],
            'rows'  => $withRows ? self::rowsForGuide($pdo, $id) : [],
        ];
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function rowsForGuide(PDO $pdo, int $guideId): array
    {
        $stmt = $pdo->prepare(
            'SELECT id, size_label, chest_min, chest_max, waist_min, waist_max,
                    height_min, height_max, sort_order
             FROM size_guide_rows
             WHERE size_guide_id = ?
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([$guideId]);

        return array_map(static fn (array $r): array => self::formatRow($r), $stmt->fetchAll());
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function resolveForProduct(PDO $pdo, int $productId, ?int $categoryId, ?int $productGuideId): ?array
    {
        if ($productGuideId !== null && $productGuideId > 0) {
            $guide = self::getById($pdo, $productGuideId, true);
            if ($guide !== null) {
                return $guide;
            }
        }

        if ($categoryId === null || $categoryId <= 0) {
            return null;
        }

        $guideId = self::categoryGuideId($pdo, $categoryId);
        if ($guideId === null) {
            return null;
        }

        return self::getById($pdo, $guideId, true);
    }

    private static function categoryGuideId(PDO $pdo, int $categoryId): ?int
    {
        $visited = [];
        $current = $categoryId;

        while ($current > 0 && !in_array($current, $visited, true)) {
            $visited[] = $current;
            $stmt = $pdo->prepare('SELECT id, parent_id, size_guide_id FROM categories WHERE id = ?');
            $stmt->execute([$current]);
            $row = $stmt->fetch();
            if ($row === false) {
                break;
            }
            if ($row['size_guide_id'] !== null && (int) $row['size_guide_id'] > 0) {
                return (int) $row['size_guide_id'];
            }
            $current = $row['parent_id'] !== null ? (int) $row['parent_id'] : 0;
        }

        return null;
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array{size_label:string,confidence:string}|null
     */
    public static function suggestSize(array $rows, ?float $chest, ?float $waist, ?float $height): ?array
    {
        if ($rows === []) {
            return null;
        }

        $provided = array_filter([
            'chest'  => $chest,
            'waist'  => $waist,
            'height' => $height,
        ], static fn ($v) => $v !== null && $v > 0);

        if ($provided === []) {
            return null;
        }

        $matches = [];
        foreach ($rows as $row) {
            if (!self::rowMatches($row, $chest, $waist, $height)) {
                continue;
            }
            $matches[] = [
                'row'   => $row,
                'score' => self::rowMatchScore($row, $provided),
            ];
        }

        if ($matches === []) {
            return null;
        }

        usort($matches, static function (array $a, array $b): int {
            if ($a['score'] !== $b['score']) {
                return $b['score'] <=> $a['score'];
            }
            return ((int) ($a['row']['sort_order'] ?? 0)) <=> ((int) ($b['row']['sort_order'] ?? 0));
        });

        $best = $matches[0]['row'];

        return [
            'size_label' => (string) $best['size_label'],
            'confidence' => $matches[0]['score'] >= 2 ? 'high' : 'medium',
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @param array<string,float> $provided
     */
    private static function rowMatchScore(array $row, array $provided): int
    {
        $score = 0;
        foreach (['chest', 'waist', 'height'] as $dim) {
            if (!isset($provided[$dim])) {
                continue;
            }
            $min = $row[$dim . '_min'] ?? null;
            $max = $row[$dim . '_max'] ?? null;
            if ($min === null && $max === null) {
                continue;
            }
            $score++;
        }

        return $score;
    }

    /** @param array<string,mixed> $row */
    private static function rowMatches(array $row, ?float $chest, ?float $waist, ?float $height): bool
    {
        return self::dimensionOk($row, 'chest', $chest)
            && self::dimensionOk($row, 'waist', $waist)
            && self::dimensionOk($row, 'height', $height);
    }

    /** @param array<string,mixed> $row */
    private static function dimensionOk(array $row, string $dim, ?float $value): bool
    {
        $min = $row[$dim . '_min'] ?? null;
        $max = $row[$dim . '_max'] ?? null;
        if ($min === null && $max === null) {
            return true;
        }
        if ($value === null || $value <= 0) {
            return true;
        }
        if ($min !== null && $value < (float) $min) {
            return false;
        }
        if ($max !== null && $value > (float) $max) {
            return false;
        }

        return true;
    }

    /**
     * @param array{name:string,notes?:?string,rows:array<int,array<string,mixed>>} $data
     */
    public static function create(PDO $pdo, array $data): int
    {
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            Response::error('Size guide name is required.', 422);
        }

        $pdo->prepare('INSERT INTO size_guides (name, notes) VALUES (?, ?)')
            ->execute([$name, self::nullable($data['notes'] ?? null)]);

        $id = (int) $pdo->lastInsertId();
        self::replaceRows($pdo, $id, $data['rows'] ?? []);

        return $id;
    }

    /**
     * @param array{name?:string,notes?:?string,rows?:array<int,array<string,mixed>>} $data
     */
    public static function update(PDO $pdo, int $id, array $data): void
    {
        $existing = self::getById($pdo, $id, false);
        if ($existing === null) {
            Response::error('Size guide not found.', 404);
        }

        $name = trim((string) ($data['name'] ?? $existing['name']));
        if ($name === '') {
            Response::error('Size guide name is required.', 422);
        }

        $notes = array_key_exists('notes', $data)
            ? self::nullable($data['notes'])
            : $existing['notes'];

        $pdo->prepare('UPDATE size_guides SET name = ?, notes = ? WHERE id = ?')
            ->execute([$name, $notes, $id]);

        if (array_key_exists('rows', $data) && is_array($data['rows'])) {
            self::replaceRows($pdo, $id, $data['rows']);
        }
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM size_guides WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            Response::error('Size guide not found.', 404);
        }
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     */
    private static function replaceRows(PDO $pdo, int $guideId, array $rows): void
    {
        $pdo->prepare('DELETE FROM size_guide_rows WHERE size_guide_id = ?')->execute([$guideId]);

        $insert = $pdo->prepare(
            'INSERT INTO size_guide_rows
                (size_guide_id, size_label, chest_min, chest_max, waist_min, waist_max,
                 height_min, height_max, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $order = 0;
        foreach ($rows as $row) {
            $label = trim((string) ($row['size_label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $insert->execute([
                $guideId,
                $label,
                self::num($row['chest_min'] ?? null),
                self::num($row['chest_max'] ?? null),
                self::num($row['waist_min'] ?? null),
                self::num($row['waist_max'] ?? null),
                self::num($row['height_min'] ?? null),
                self::num($row['height_max'] ?? null),
                isset($row['sort_order']) ? (int) $row['sort_order'] : $order,
            ]);
            $order++;
        }
    }

    /** @return array<string,mixed> */
    private static function formatRow(array $r): array
    {
        return [
            'id'         => (int) $r['id'],
            'size_label' => $r['size_label'],
            'chest_min'  => $r['chest_min'] !== null ? (float) $r['chest_min'] : null,
            'chest_max'  => $r['chest_max'] !== null ? (float) $r['chest_max'] : null,
            'waist_min'  => $r['waist_min'] !== null ? (float) $r['waist_min'] : null,
            'waist_max'  => $r['waist_max'] !== null ? (float) $r['waist_max'] : null,
            'height_min' => $r['height_min'] !== null ? (float) $r['height_min'] : null,
            'height_max' => $r['height_max'] !== null ? (float) $r['height_max'] : null,
            'sort_order' => (int) $r['sort_order'],
        ];
    }

    private static function nullable(mixed $value): ?string
    {
        $v = trim((string) ($value ?? ''));
        return $v !== '' ? $v : null;
    }

    private static function num(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value)) {
            return null;
        }
        return round((float) $value, 1);
    }

    /**
     * @return array{exchange_enabled:bool,exchange_within_days:int,exchange_summary:?string,return_policy:?string}
     */
    public static function checkoutPolicies(PDO $pdo): array
    {
        $defaults = [
            'exchange_enabled'     => true,
            'exchange_within_days' => 7,
            'exchange_policy_note' => null,
            'return_policy'        => null,
        ];

        try {
            $row = $pdo->query(
                'SELECT exchange_enabled, exchange_within_days, exchange_policy_note, return_policy
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            $row = false;
        }

        if ($row === false) {
            return self::formatPolicies($defaults);
        }

        return self::formatPolicies([
            'exchange_enabled'     => (bool) ($row['exchange_enabled'] ?? 1),
            'exchange_within_days' => max(1, (int) ($row['exchange_within_days'] ?? 7)),
            'exchange_policy_note' => $row['exchange_policy_note'] ?? null,
            'return_policy'        => $row['return_policy'] ?? null,
        ]);
    }

    /**
     * @param array<string,mixed> $row
     * @return array{exchange_enabled:bool,exchange_within_days:int,exchange_summary:?string,return_policy:?string}
     */
    private static function formatPolicies(array $row): array
    {
        $enabled = (bool) ($row['exchange_enabled'] ?? true);
        $days = max(1, (int) ($row['exchange_within_days'] ?? 7));
        $note = trim((string) ($row['exchange_policy_note'] ?? ''));

        $summary = null;
        if ($enabled) {
            $summary = $note !== ''
                ? $note
                : "Wrong size or weight? Exchange within {$days} days of delivery (eligible items).";
        }

        return [
            'exchange_enabled'     => $enabled,
            'exchange_within_days' => $days,
            'exchange_summary'     => $summary,
            'return_policy'        => self::nullable($row['return_policy'] ?? null),
        ];
    }
}
