<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_categories');

$pdo = Database::pdo();
$body = Response::body();

$name = trim((string) ($body['name'] ?? ''));
if ($name === '') {
    Response::error('Category name is required.', 422);
}

$slug = trim((string) ($body['slug'] ?? ''));
if ($slug === '') {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? '');
    $slug = trim($slug, '-');
}

$check = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
$check->execute([$slug]);
if ($check->fetch() !== false) {
    Response::error('A category with this slug already exists.', 409);
}

$pdo->prepare(
    'INSERT INTO categories (name, slug, description, image_url, parent_id) VALUES (?, ?, ?, ?, ?)'
)->execute([
    $name,
    $slug,
    trim((string) ($body['description'] ?? '')) ?: null,
    trim((string) ($body['image_url'] ?? '')) ?: null,
    !empty($body['parent_id']) ? (int) $body['parent_id'] : null,
]);

$id = (int) $pdo->lastInsertId();

Response::success([
    'message'  => 'Category created.',
    'category' => [
        'id'          => $id,
        'name'        => $name,
        'slug'        => $slug,
        'description' => $body['description'] ?? null,
        'image_url'   => $body['image_url'] ?? null,
        'parent_id'   => !empty($body['parent_id']) ? (int) $body['parent_id'] : null,
    ],
], 201);
