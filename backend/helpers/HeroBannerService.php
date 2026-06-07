<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class HeroBannerService
{
    public const THEMES = ['green', 'gold', 'forest'];

    /** @return list<array<string,mixed>> */
    public static function listActive(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT id, kicker, title, subtitle, cta_label, link_to, image_url, theme, is_active, sort_order
             FROM hero_banners
             WHERE is_active = 1
             ORDER BY sort_order ASC, id ASC'
        );

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT id, kicker, title, subtitle, cta_label, link_to, image_url, theme, is_active, sort_order, created_at, updated_at
             FROM hero_banners
             ORDER BY sort_order ASC, id ASC'
        );

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input): array
    {
        $row = self::normalizeInput($input);
        $pdo->prepare(
            'INSERT INTO hero_banners (kicker, title, subtitle, cta_label, link_to, image_url, theme, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $row['kicker'],
            $row['title'],
            $row['subtitle'],
            $row['cta_label'],
            $row['link_to'],
            $row['image_url'],
            $row['theme'],
            $row['is_active'],
            $row['sort_order'],
        ]);

        return self::findById($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        if (self::findById($pdo, $id) === null) {
            throw new \InvalidArgumentException('Hero banner not found.');
        }

        $row = self::normalizeInput($input);
        $pdo->prepare(
            'UPDATE hero_banners SET kicker = ?, title = ?, subtitle = ?, cta_label = ?, link_to = ?,
                    image_url = ?, theme = ?, is_active = ?, sort_order = ? WHERE id = ?'
        )->execute([
            $row['kicker'],
            $row['title'],
            $row['subtitle'],
            $row['cta_label'],
            $row['link_to'],
            $row['image_url'],
            $row['theme'],
            $row['is_active'],
            $row['sort_order'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM hero_banners WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            throw new \InvalidArgumentException('Hero banner not found.');
        }
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id, kicker, title, subtitle, cta_label, link_to, image_url, theme, is_active, sort_order, created_at, updated_at
             FROM hero_banners WHERE id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    /** @param array<string,mixed> $input */
    private static function normalizeInput(array $input): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('Title is required.');
        }

        $theme = strtolower(trim((string) ($input['theme'] ?? 'green')));
        if (!in_array($theme, self::THEMES, true)) {
            $theme = 'green';
        }

        $link = trim((string) ($input['link_to'] ?? '/shop'));
        if ($link === '' || $link[0] !== '/') {
            throw new \InvalidArgumentException('Link must start with / (e.g. /shop).');
        }

        $image = trim((string) ($input['image_url'] ?? ''));

        return [
            'kicker'      => trim((string) ($input['kicker'] ?? '')),
            'title'       => $title,
            'subtitle'    => trim((string) ($input['subtitle'] ?? '')),
            'cta_label'   => trim((string) ($input['cta_label'] ?? 'Shop now')) ?: 'Shop now',
            'link_to'     => $link,
            'image_url'   => $image !== '' ? $image : null,
            'theme'       => $theme,
            'is_active'   => !empty($input['is_active']) ? 1 : 0,
            'sort_order'  => (int) ($input['sort_order'] ?? 0),
        ];
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'          => (int) $row['id'],
            'kicker'      => (string) $row['kicker'],
            'title'       => (string) $row['title'],
            'subtitle'    => (string) $row['subtitle'],
            'cta_label'   => (string) $row['cta_label'],
            'link_to'     => (string) $row['link_to'],
            'image_url'   => $row['image_url'] ?? null,
            'theme'       => (string) $row['theme'],
            'is_active'   => (int) ($row['is_active'] ?? 0) === 1,
            'sort_order'  => (int) ($row['sort_order'] ?? 0),
            'created_at'  => $row['created_at'] ?? null,
            'updated_at'  => $row['updated_at'] ?? null,
        ];
    }
}
