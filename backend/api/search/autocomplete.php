<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductQuery;
use App\Helpers\Response;

$q = trim((string) ($_GET['q'] ?? ''));

// Require at least 2 characters to avoid noisy keystroke queries.
if (mb_strlen($q) < 2) {
    Response::success(['products' => [], 'categories' => [], 'suggestions' => []]);
}

$pdo = Database::pdo();
$like = '%' . $q . '%';

[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, null);
$productStmt = $pdo->prepare(
    "SELECT p.id, p.name, p.price, p.images, p.slug, p.shop_id,
            s.slug AS shop_slug
     FROM products p
     LEFT JOIN shops s ON s.id = p.shop_id
     WHERE (p.name LIKE ? OR p.description LIKE ? OR JSON_SEARCH(p.tags, 'one', ?) IS NOT NULL)
       AND p.status = 'active' AND p.stock_qty > 0
       AND {$marketSql}
     ORDER BY p.name ASC
     LIMIT 5"
);
$productStmt->execute(array_merge([$like, $like, $like], $marketParams));
$products = array_map(static function (array $r): array {
    $images = $r['images'] ? (json_decode((string) $r['images'], true) ?: []) : [];
    $shopId = $r['shop_id'] !== null ? (int) $r['shop_id'] : null;
    return [
        'id'        => (int) $r['id'],
        'name'      => $r['name'],
        'slug'      => $r['slug'],
        'price'     => (float) $r['price'],
        'images'    => is_array($images) ? $images : [],
        'shop_id'   => $shopId,
        'shop_slug' => $r['shop_slug'] !== null ? (string) $r['shop_slug'] : null,
    ];
}, $productStmt->fetchAll());

$categoryStmt = $pdo->prepare(
    'SELECT id, name, slug FROM categories WHERE name LIKE ? ORDER BY name ASC LIMIT 3'
);
$categoryStmt->execute([$like]);
$categories = array_map(static fn (array $r): array => [
    'id'   => (int) $r['id'],
    'name' => $r['name'],
    'slug' => $r['slug'],
], $categoryStmt->fetchAll());

$suggestStmt = $pdo->prepare(
    'SELECT query FROM search_logs WHERE query LIKE ? GROUP BY query ORDER BY COUNT(*) DESC LIMIT 4'
);
$suggestStmt->execute([$like]);
$suggestions = array_map(static fn (array $r): string => (string) $r['query'], $suggestStmt->fetchAll());

$log = $pdo->prepare(
    "INSERT INTO search_logs (user_id, query, results_count, search_type) VALUES (NULL, ?, ?, 'text')"
);
$log->execute([$q, count($products)]);

Response::success([
    'products'    => $products,
    'categories'  => $categories,
    'suggestions' => $suggestions,
]);
