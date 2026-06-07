<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$pdo = Database::pdo();

try {
    $rows = $pdo->query(
        'SELECT id, name, slug, description, image_url, parent_id, size_guide_id FROM categories ORDER BY name ASC'
    )->fetchAll();
} catch (\Throwable) {
    $rows = $pdo->query(
        'SELECT id, name, slug, description, image_url, parent_id FROM categories ORDER BY name ASC'
    )->fetchAll();
}

$nodes = array_map(static function (array $r): array {
    return [
        'id'            => (int) $r['id'],
        'name'          => $r['name'],
        'slug'          => $r['slug'],
        'description'   => $r['description'],
        'image_url'     => $r['image_url'],
        'parent_id'     => $r['parent_id'] !== null ? (int) $r['parent_id'] : null,
        'size_guide_id' => isset($r['size_guide_id']) && $r['size_guide_id'] !== null
            ? (int) $r['size_guide_id']
            : null,
    ];
}, $rows);

$buildTree = static function (?int $parentId) use (&$buildTree, $nodes): array {
    $branch = [];
    foreach ($nodes as $node) {
        if ($node['parent_id'] === $parentId) {
            $node['children'] = $buildTree($node['id']);
            $branch[] = $node;
        }
    }
    return $branch;
};

Response::success(['data' => $buildTree(null)]);
