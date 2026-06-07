<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Kit templates: bundled product checklists for leaders and members. */
final class KitBuilderService
{
    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listAll(PDO $pdo, bool $publishedOnly = false): array
    {
        try {
            $sql = 'SELECT id, name, slug, description, leader_note, image_url,
                           is_published, sort_order, created_at, updated_at
                    FROM kit_templates';
            if ($publishedOnly) {
                $sql .= ' WHERE is_published = 1';
            }
            $sql .= ' ORDER BY sort_order ASC, name ASC';
            $rows = $pdo->query($sql)->fetchAll();
        } catch (\Throwable) {
            return [];
        }

        return array_map(static fn (array $r): array => self::formatKit($r), $rows);
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function getById(PDO $pdo, int $id, bool $withItems = true, bool $publishedOnly = false): ?array
    {
        if ($id <= 0) {
            return null;
        }

        try {
            $sql = 'SELECT id, name, slug, description, leader_note, image_url,
                           is_published, sort_order, created_at, updated_at
                    FROM kit_templates WHERE id = ?';
            if ($publishedOnly) {
                $sql .= ' AND is_published = 1';
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $kit = $stmt->fetch();
        } catch (\Throwable) {
            return null;
        }

        if ($kit === false) {
            return null;
        }

        $formatted = self::formatKit($kit);
        if ($withItems) {
            $formatted['items'] = self::itemsForKit($pdo, $id, $publishedOnly);
        }

        return $formatted;
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function getBySlug(PDO $pdo, string $slug, bool $publishedOnly = true): ?array
    {
        $slug = trim($slug);
        if ($slug === '') {
            return null;
        }

        try {
            $sql = 'SELECT id, name, slug, description, leader_note, image_url,
                           is_published, sort_order, created_at, updated_at
                    FROM kit_templates WHERE slug = ?';
            if ($publishedOnly) {
                $sql .= ' AND is_published = 1';
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$slug]);
            $kit = $stmt->fetch();
        } catch (\Throwable) {
            return null;
        }

        if ($kit === false) {
            return null;
        }

        $id = (int) $kit['id'];
        $formatted = self::formatKit($kit);
        $formatted['items'] = self::itemsForKit($pdo, $id, $publishedOnly);

        return $formatted;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function itemsForKit(PDO $pdo, int $kitId, bool $activeProductsOnly = false): array
    {
        $sql = 'SELECT i.id, i.kit_template_id, i.product_id, i.is_required, i.item_label, i.note, i.sort_order,
                       p.name AS product_name, p.slug AS product_slug, p.price, p.compare_at_price,
                       p.images, p.tags, p.is_preorder, p.stock_qty, p.badge_label, p.status
                FROM kit_template_items i
                INNER JOIN products p ON p.id = i.product_id
                WHERE i.kit_template_id = ?';
        if ($activeProductsOnly) {
            $sql .= " AND p.status = 'active'";
        }
        $sql .= ' ORDER BY i.sort_order ASC, i.id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$kitId]);

        return array_map(static function (array $r): array {
            $images = json_decode((string) ($r['images'] ?? '[]'), true);
            if (!is_array($images)) {
                $images = [];
            }

            return [
                'id'          => (int) $r['id'],
                'product_id'  => (int) $r['product_id'],
                'is_required' => (bool) $r['is_required'],
                'item_label'  => $r['item_label'],
                'note'        => $r['note'],
                'sort_order'  => (int) $r['sort_order'],
                'label'       => $r['item_label'] ?: $r['product_name'],
                'product'     => [
                    'id'               => (int) $r['product_id'],
                    'name'             => $r['product_name'],
                    'slug'             => $r['product_slug'],
                    'price'            => (float) $r['price'],
                    'compare_at_price' => $r['compare_at_price'] !== null ? (float) $r['compare_at_price'] : null,
                    'images'           => $images,
                    'is_preorder'      => (bool) $r['is_preorder'],
                    'stock_qty'        => (int) $r['stock_qty'],
                    'badge_label'      => $r['badge_label'],
                    'status'           => $r['status'],
                ],
            ];
        }, $stmt->fetchAll());
    }

    /**
     * @param array{name:string,slug?:?string,description?:?string,leader_note?:?string,image_url?:?string,is_published?:bool,sort_order?:int,items:array<int,array<string,mixed>>} $data
     */
    public static function create(PDO $pdo, array $data): int
    {
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            Response::error('Kit name is required.', 422);
        }

        $slug = self::resolveSlug($pdo, trim((string) ($data['slug'] ?? '')), $name, null);

        $pdo->prepare(
            'INSERT INTO kit_templates (name, slug, description, leader_note, image_url, is_published, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $name,
            $slug,
            self::nullable($data['description'] ?? null),
            self::nullable($data['leader_note'] ?? null),
            self::nullable($data['image_url'] ?? null),
            !empty($data['is_published']) ? 1 : 0,
            isset($data['sort_order']) ? (int) $data['sort_order'] : 0,
        ]);

        $id = (int) $pdo->lastInsertId();
        self::replaceItems($pdo, $id, $data['items'] ?? []);

        return $id;
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function update(PDO $pdo, int $id, array $data): void
    {
        $existing = self::getById($pdo, $id, false, false);
        if ($existing === null) {
            Response::error('Kit not found.', 404);
        }

        $name = trim((string) ($data['name'] ?? $existing['name']));
        if ($name === '') {
            Response::error('Kit name is required.', 422);
        }

        $slug = array_key_exists('slug', $data)
            ? self::resolveSlug($pdo, trim((string) $data['slug']), $name, $id)
            : $existing['slug'];

        $pdo->prepare(
            'UPDATE kit_templates SET name = ?, slug = ?, description = ?, leader_note = ?,
             image_url = ?, is_published = ?, sort_order = ? WHERE id = ?'
        )->execute([
            $name,
            $slug,
            array_key_exists('description', $data)
                ? self::nullable($data['description'])
                : $existing['description'],
            array_key_exists('leader_note', $data)
                ? self::nullable($data['leader_note'])
                : $existing['leader_note'],
            array_key_exists('image_url', $data)
                ? self::nullable($data['image_url'])
                : $existing['image_url'],
            array_key_exists('is_published', $data)
                ? (!empty($data['is_published']) ? 1 : 0)
                : ($existing['is_published'] ? 1 : 0),
            array_key_exists('sort_order', $data)
                ? (int) $data['sort_order']
                : (int) $existing['sort_order'],
            $id,
        ]);

        if (array_key_exists('items', $data) && is_array($data['items'])) {
            self::replaceItems($pdo, $id, $data['items']);
        }
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM kit_templates WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            Response::error('Kit not found.', 404);
        }
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private static function replaceItems(PDO $pdo, int $kitId, array $items): void
    {
        $pdo->prepare('DELETE FROM kit_template_items WHERE kit_template_id = ?')->execute([$kitId]);

        $insert = $pdo->prepare(
            'INSERT INTO kit_template_items
                (kit_template_id, product_id, is_required, item_label, note, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        $order = 0;
        $seen = [];
        foreach ($items as $row) {
            $productId = (int) ($row['product_id'] ?? 0);
            if ($productId <= 0 || isset($seen[$productId])) {
                continue;
            }
            $seen[$productId] = true;

            $check = $pdo->prepare('SELECT id FROM products WHERE id = ?');
            $check->execute([$productId]);
            if ($check->fetch() === false) {
                continue;
            }

            $insert->execute([
                $kitId,
                $productId,
                !empty($row['is_required']) ? 1 : 0,
                self::nullable($row['item_label'] ?? null),
                self::nullable($row['note'] ?? null),
                isset($row['sort_order']) ? (int) $row['sort_order'] : $order,
            ]);
            $order++;
        }
    }

    private static function resolveSlug(PDO $pdo, string $slug, string $name, ?int $excludeId): string
    {
        if ($slug === '') {
            $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '');
            $slug = trim($slug, '-');
        } else {
            $slug = self::normalizeSlug($slug);
        }
        if ($slug === '') {
            $slug = 'kit';
        }

        $base = $slug;
        $suffix = 0;
        while (true) {
            $candidate = $suffix > 0 ? "{$base}-{$suffix}" : $base;
            $sql = 'SELECT id FROM kit_templates WHERE slug = ?';
            $params = [$candidate];
            if ($excludeId !== null) {
                $sql .= ' AND id != ?';
                $params[] = $excludeId;
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            if ($stmt->fetch() === false) {
                return $candidate;
            }
            $suffix++;
        }
    }

    /** @param array<string,mixed> $row */
    private static function formatKit(array $row): array
    {
        return [
            'id'           => (int) $row['id'],
            'name'         => $row['name'],
            'slug'         => $row['slug'],
            'description'  => $row['description'],
            'leader_note'  => $row['leader_note'],
            'image_url'    => $row['image_url'],
            'is_published' => (bool) ($row['is_published'] ?? 0),
            'sort_order'   => (int) ($row['sort_order'] ?? 0),
            'created_at'   => $row['created_at'] ?? null,
            'updated_at'   => $row['updated_at'] ?? null,
        ];
    }

    private static function nullable(mixed $value): ?string
    {
        $v = trim((string) ($value ?? ''));
        return $v !== '' ? $v : null;
    }

    private static function normalizeSlug(string $slug): string
    {
        $slug = strtolower(trim($slug));
        $slug = str_replace('_', '-', $slug);
        $slug = preg_replace('/[^a-z0-9-]+/', '-', $slug) ?? '';
        $slug = trim(preg_replace('/-+/', '-', $slug) ?? '', '-');
        return $slug;
    }
}
