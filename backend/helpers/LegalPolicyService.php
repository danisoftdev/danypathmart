<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class LegalPolicyService
{
    /** @return list<array<string,mixed>> */
    public static function listFooter(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT slug, title FROM legal_policies
             WHERE is_published = 1 AND show_in_footer = 1
             ORDER BY sort_order ASC, id ASC'
        );

        return array_map(static fn (array $r): array => [
            'slug'  => (string) $r['slug'],
            'title' => (string) $r['title'],
        ], $stmt->fetchAll());
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT id, slug, title, body, is_published, show_in_footer, sort_order, created_at, updated_at
             FROM legal_policies
             ORDER BY sort_order ASC, id ASC'
        );

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findPublishedBySlug(PDO $pdo, string $slug): ?array
    {
        $slug = self::normalizeSlug($slug);
        $stmt = $pdo->prepare(
            'SELECT id, slug, title, body, is_published, show_in_footer, sort_order, updated_at
             FROM legal_policies WHERE slug = ? AND is_published = 1 LIMIT 1'
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input): array
    {
        $row = self::normalizeInput($input, $pdo, null);
        $pdo->prepare(
            'INSERT INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            $row['slug'],
            $row['title'],
            $row['body'],
            $row['is_published'],
            $row['show_in_footer'],
            $row['sort_order'],
        ]);

        return self::findById($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Policy not found.');
        }

        $row = self::normalizeInput($input, $pdo, $id);
        $pdo->prepare(
            'UPDATE legal_policies SET slug = ?, title = ?, body = ?, is_published = ?, show_in_footer = ?, sort_order = ? WHERE id = ?'
        )->execute([
            $row['slug'],
            $row['title'],
            $row['body'],
            $row['is_published'],
            $row['show_in_footer'],
            $row['sort_order'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM legal_policies WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            throw new \InvalidArgumentException('Policy not found.');
        }
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id, slug, title, body, is_published, show_in_footer, sort_order, created_at, updated_at
             FROM legal_policies WHERE id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    public static function countPublished(PDO $pdo): int
    {
        return (int) $pdo->query('SELECT COUNT(*) FROM legal_policies WHERE is_published = 1')->fetchColumn();
    }

    /** Published policies linked at checkout (returns, privacy, terms). */
    /** @return list<array{slug:string,title:string,path:string}> */
    public static function checkoutTrustLinks(PDO $pdo): array
    {
        $links = [];
        foreach (['returns', 'privacy', 'terms', 'payments'] as $slug) {
            $policy = self::findPublishedBySlug($pdo, $slug);
            if ($policy === null) {
                continue;
            }
            $links[] = [
                'slug'  => $slug,
                'title' => (string) $policy['title'],
                'path'  => '/policies/' . $slug,
            ];
        }

        return $links;
    }

    /** @param array<string,mixed> $input */
    private static function normalizeInput(array $input, PDO $pdo, ?int $excludeId): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('Title is required.');
        }

        $body = trim((string) ($input['body'] ?? ''));
        if (strlen($body) < 20) {
            throw new \InvalidArgumentException('Policy body must be at least 20 characters.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title) ?? '');
            $slug = trim($slug, '-');
        }
        $slug = self::normalizeSlug($slug);

        $check = $pdo->prepare('SELECT id FROM legal_policies WHERE slug = ? AND id <> COALESCE(?, 0)');
        $check->execute([$slug, $excludeId ?? 0]);
        if ($check->fetch() !== false) {
            throw new \InvalidArgumentException('A policy with this slug already exists.');
        }

        return [
            'slug'            => $slug,
            'title'           => $title,
            'body'            => $body,
            'is_published'    => !empty($input['is_published']) ? 1 : 0,
            'show_in_footer'  => !array_key_exists('show_in_footer', $input) || !empty($input['show_in_footer']) ? 1 : 0,
            'sort_order'      => (int) ($input['sort_order'] ?? 0),
        ];
    }

    public static function normalizeSlug(string $slug): string
    {
        $slug = strtolower(trim($slug));
        $slug = preg_replace('/[^a-z0-9-]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        if ($slug === '') {
            throw new \InvalidArgumentException('Invalid policy slug.');
        }

        return $slug;
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'slug'            => (string) $row['slug'],
            'title'           => (string) $row['title'],
            'body'            => (string) $row['body'],
            'is_published'    => (int) ($row['is_published'] ?? 0) === 1,
            'show_in_footer'  => (int) ($row['show_in_footer'] ?? 0) === 1,
            'sort_order'      => (int) ($row['sort_order'] ?? 0),
            'created_at'      => $row['created_at'] ?? null,
            'updated_at'      => $row['updated_at'] ?? null,
        ];
    }
}
