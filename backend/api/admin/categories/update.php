<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CategoryService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_categories');

$pdo = Database::pdo();
$categoryId = (int) ($_GET['id'] ?? 0);
if ($categoryId <= 0) {
    Response::error('Category not found.', 404);
}

$body = Response::body();
$stmt = $pdo->prepare('SELECT * FROM categories WHERE id = ?');
$stmt->execute([$categoryId]);
$existing = $stmt->fetch();
if ($existing === false) {
    Response::error('Category not found.', 404);
}

$name = trim((string) ($body['name'] ?? $existing['name']));
if ($name === '') {
    Response::error('Category name is required.', 422);
}

$slug = trim((string) ($body['slug'] ?? $existing['slug']));
if ($slug === '') {
    $slug = CategoryService::uniqueSlug($pdo, $name, $categoryId);
} else {
    $slug = CategoryService::uniqueSlug($pdo, $slug, $categoryId);
}

$parentId = array_key_exists('parent_id', $body)
    ? ($body['parent_id'] !== null && $body['parent_id'] !== '' ? (int) $body['parent_id'] : null)
    : ($existing['parent_id'] !== null ? (int) $existing['parent_id'] : null);
if ($parentId !== null && $parentId <= 0) {
    $parentId = null;
}

try {
    CategoryService::assertValidParent($pdo, $categoryId, $parentId);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

if (CategoryService::siblingNameExists($pdo, $name, $parentId, $categoryId)) {
    $where = $parentId === null ? 'at the top level' : 'under this parent';
    Response::error("Category \"{$name}\" already exists {$where}.", 422);
}

$sizeGuideId = array_key_exists('size_guide_id', $body)
    ? ($body['size_guide_id'] !== null && $body['size_guide_id'] !== '' ? (int) $body['size_guide_id'] : null)
    : ($existing['size_guide_id'] ?? null);

try {
    $pdo->prepare(
        'UPDATE categories SET name = ?, slug = ?, description = ?, image_url = ?, parent_id = ?, size_guide_id = ? WHERE id = ?'
    )->execute([
        $name,
        $slug,
        array_key_exists('description', $body) ? ($body['description'] ?: null) : $existing['description'],
        array_key_exists('image_url', $body) ? ($body['image_url'] ?: null) : $existing['image_url'],
        $parentId,
        $sizeGuideId,
        $categoryId,
    ]);
} catch (\Throwable) {
    $pdo->prepare(
        'UPDATE categories SET name = ?, slug = ?, description = ?, image_url = ?, parent_id = ? WHERE id = ?'
    )->execute([
        $name,
        $slug,
        array_key_exists('description', $body) ? ($body['description'] ?: null) : $existing['description'],
        array_key_exists('image_url', $body) ? ($body['image_url'] ?: null) : $existing['image_url'],
        $parentId,
        $categoryId,
    ]);
}

Response::success([
    'message' => 'Category updated.',
    'category' => [
        'id'          => $categoryId,
        'name'        => $name,
        'slug'        => $slug,
    ],
]);
