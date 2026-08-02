<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Category create/update helpers — hierarchy + bulk names. */
final class CategoryService
{
    /**
     * Split a bulk string into unique category names.
     * Accepts commas, newlines, or semicolons as separators.
     *
     * @return list<string>
     */
    public static function parseNames(string $raw): array
    {
        $parts = preg_split('/[\n\r,;]+/', $raw) ?: [];
        $out = [];
        $seen = [];
        foreach ($parts as $part) {
            $name = trim((string) $part);
            if ($name === '') {
                continue;
            }
            $key = mb_strtolower($name);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $name;
        }

        return $out;
    }

    public static function slugify(string $name): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '');
        $slug = trim($slug, '-');
        if ($slug === '') {
            $slug = 'category';
        }

        return substr($slug, 0, 140);
    }

    public static function uniqueSlug(PDO $pdo, string $base, ?int $excludeId = null): string
    {
        $base = self::slugify($base);
        $slug = $base;
        $n = 2;
        while (true) {
            if ($excludeId !== null) {
                $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1');
                $stmt->execute([$slug, $excludeId]);
            } else {
                $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = ? LIMIT 1');
                $stmt->execute([$slug]);
            }
            if ($stmt->fetch() === false) {
                return $slug;
            }
            $suffix = '-' . $n;
            $slug = substr($base, 0, max(1, 140 - strlen($suffix))) . $suffix;
            $n++;
            if ($n > 500) {
                return $base . '-' . bin2hex(random_bytes(2));
            }
        }
    }

    public static function assertParentExists(PDO $pdo, ?int $parentId): void
    {
        if ($parentId === null || $parentId <= 0) {
            return;
        }
        $stmt = $pdo->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
        $stmt->execute([$parentId]);
        if ($stmt->fetch() === false) {
            throw new \InvalidArgumentException('Parent category not found.');
        }
    }

    /**
     * Prevent cycles: parent cannot be self or a descendant of the category.
     */
    public static function assertValidParent(PDO $pdo, int $categoryId, ?int $parentId): void
    {
        if ($parentId === null || $parentId <= 0) {
            return;
        }
        if ($parentId === $categoryId) {
            throw new \InvalidArgumentException('A category cannot be its own parent.');
        }
        self::assertParentExists($pdo, $parentId);
        $descendants = self::descendantIds($pdo, $categoryId);
        if (in_array($parentId, $descendants, true)) {
            throw new \InvalidArgumentException('Cannot set a subcategory as the parent.');
        }
    }

    /**
     * @return list<int> child/grandchild ids (not including $rootId)
     */
    public static function descendantIds(PDO $pdo, int $rootId): array
    {
        if ($rootId <= 0) {
            return [];
        }
        $rows = $pdo->query('SELECT id, parent_id FROM categories')->fetchAll();
        $byParent = [];
        foreach ($rows as $row) {
            $pid = $row['parent_id'] !== null ? (int) $row['parent_id'] : 0;
            $byParent[$pid][] = (int) $row['id'];
        }
        $out = [];
        $stack = $byParent[$rootId] ?? [];
        while ($stack !== []) {
            $id = array_pop($stack);
            if (isset($out[$id])) {
                continue;
            }
            $out[$id] = true;
            foreach ($byParent[$id] ?? [] as $child) {
                $stack[] = $child;
            }
        }

        return array_map('intval', array_keys($out));
    }

    /**
     * @return list<int>
     */
    public static function selfAndDescendantIds(PDO $pdo, int $categoryId): array
    {
        return array_values(array_unique(array_merge([$categoryId], self::descendantIds($pdo, $categoryId))));
    }

    /**
     * @param array{name:string,slug?:string,description?:?string,image_url?:?string,parent_id?:?int} $input
     * @return array<string,mixed>
     */
    public static function createOne(PDO $pdo, array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '' || mb_strlen($name) < 1) {
            throw new \InvalidArgumentException('Category name is required.');
        }
        if (mb_strlen($name) > 120) {
            throw new \InvalidArgumentException('Category name is too long (max 120 characters).');
        }

        $parentId = !empty($input['parent_id']) ? (int) $input['parent_id'] : null;
        if ($parentId !== null && $parentId <= 0) {
            $parentId = null;
        }
        self::assertParentExists($pdo, $parentId);

        $slugInput = trim((string) ($input['slug'] ?? ''));
        $slug = $slugInput !== ''
            ? self::uniqueSlug($pdo, $slugInput)
            : self::uniqueSlug($pdo, $name);

        $description = isset($input['description']) ? trim((string) $input['description']) : '';
        $imageUrl = isset($input['image_url']) ? trim((string) $input['image_url']) : '';

        $pdo->prepare(
            'INSERT INTO categories (name, slug, description, image_url, parent_id) VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $name,
            $slug,
            $description !== '' ? $description : null,
            $imageUrl !== '' ? $imageUrl : null,
            $parentId,
        ]);

        $id = (int) $pdo->lastInsertId();

        return [
            'id'          => $id,
            'name'        => $name,
            'slug'        => $slug,
            'description' => $description !== '' ? $description : null,
            'image_url'   => $imageUrl !== '' ? $imageUrl : null,
            'parent_id'   => $parentId,
        ];
    }

    /**
     * @param list<string>|string $names
     * @return list<array<string,mixed>>
     */
    public static function createBulk(PDO $pdo, array|string $names, ?int $parentId = null): array
    {
        $list = is_array($names) ? $names : self::parseNames($names);
        if ($list === []) {
            throw new \InvalidArgumentException('Enter at least one category name.');
        }
        if (count($list) > 100) {
            throw new \InvalidArgumentException('You can add at most 100 categories at once.');
        }

        self::assertParentExists($pdo, $parentId);

        $created = [];
        $pdo->beginTransaction();
        try {
            foreach ($list as $name) {
                $created[] = self::createOne($pdo, [
                    'name'      => $name,
                    'parent_id' => $parentId,
                ]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return $created;
    }
}
