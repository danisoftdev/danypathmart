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
$body = Response::body();

$parentId = !empty($body['parent_id']) ? (int) $body['parent_id'] : null;
if ($parentId !== null && $parentId <= 0) {
    $parentId = null;
}

// Bulk: names[] array, or names/bulk text ("Fashion, Groceries" / newlines).
if (isset($body['names']) && is_array($body['names'])) {
    $list = [];
    foreach ($body['names'] as $n) {
        $t = trim((string) $n);
        if ($t !== '') {
            $list[] = $t;
        }
    }
} else {
    $bulkRaw = trim((string) ($body['names'] ?? $body['bulk'] ?? $body['name'] ?? ''));
    $explicitBulk = array_key_exists('names', $body) || array_key_exists('bulk', $body);
    $hasSeparators = preg_match('/[\n\r,;]/', $bulkRaw) === 1;
    if ($explicitBulk || $hasSeparators) {
        $list = CategoryService::parseNames($bulkRaw);
    } else {
        $list = $bulkRaw !== '' ? [$bulkRaw] : [];
    }
}

if ($list === []) {
    Response::error('Category name is required. For bulk, separate names with commas or new lines.', 422);
}

$isSingle = count($list) === 1
    && !array_key_exists('bulk', $body)
    && !(isset($body['names']) && is_array($body['names']));

try {
    if ($isSingle) {
        $category = CategoryService::createOne($pdo, [
            'name'        => $list[0],
            'slug'        => trim((string) ($body['slug'] ?? '')),
            'description' => $body['description'] ?? null,
            'image_url'   => $body['image_url'] ?? null,
            'parent_id'   => $parentId,
        ]);
        Response::success([
            'message'       => 'Category created.',
            'category'      => $category,
            'categories'    => [$category],
            'created'       => 1,
            'skipped'       => [],
            'skipped_count' => 0,
        ], 201);
    }

    $result = CategoryService::createBulk($pdo, $list, $parentId);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable $e) {
    error_log('admin/categories/create: ' . $e->getMessage());
    Response::error('Could not create categories.', 500);
}

$created = (int) ($result['created'] ?? 0);
$skipped = $result['skipped'] ?? [];
$skippedCount = (int) ($result['skipped_count'] ?? count($skipped));
$categories = $result['categories'] ?? [];

if ($created === 1 && $skippedCount === 0) {
    $message = 'Category created.';
} elseif ($skippedCount === 0) {
    $message = "{$created} categories created.";
} elseif ($created === 0) {
    $message = 'No new categories added — all names already exist.';
} else {
    $message = "{$created} created, {$skippedCount} skipped (already exist).";
}

Response::success([
    'message'       => $message,
    'category'      => $categories[0] ?? null,
    'categories'    => $categories,
    'created'       => $created,
    'skipped'       => $skipped,
    'skipped_count' => $skippedCount,
], 201);
