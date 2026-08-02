<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\ProductQuery;
use App\Helpers\Response;

$pdo = Database::pdo();
$term = trim((string) ($_GET['q'] ?? ''));

[$whereSql, $params] = ProductQuery::filters($_GET);
[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, null);
$whereSql = preg_replace('/\bstatus\b/', 'p.status', $whereSql);
$whereSql = preg_replace('/\bshop_id\b/', 'p.shop_id', $whereSql);
$whereSql = preg_replace('/\bcategory_id\b/', 'p.category_id', $whereSql);
$whereSql = preg_replace('/\bprice\b/', 'p.price', $whereSql);
$whereSql = preg_replace('/\bstock_qty\b/', 'p.stock_qty', $whereSql);
$whereSql = preg_replace('/\bname\b/', 'p.name', $whereSql);
$whereSql = preg_replace('/\bdescription\b/', 'p.description', $whereSql);
$whereSql = preg_replace('/\btags\b/', 'p.tags', $whereSql);
$whereSql = preg_replace('/\borigin_country\b/', 'p.origin_country', $whereSql);
$whereSql = preg_replace('/\bis_preorder\b/', 'p.is_preorder', $whereSql);
$whereSql = preg_replace('/\bis_featured\b/', 'p.is_featured', $whereSql);
$whereSql = preg_replace('/\bis_flash_deal\b/', 'p.is_flash_deal', $whereSql);
$whereSql = $whereSql . ' AND ' . $marketSql;
$params = array_merge($params, $marketParams);

$orderBy = ProductQuery::orderBy(isset($_GET['sort']) ? (string) $_GET['sort'] : null);
// Qualify order columns for joined query.
$orderBy = preg_replace(
    '/\b(price|name|created_at)\b/',
    'p.$1',
    $orderBy
) ?? $orderBy;
$page = ProductQuery::page($_GET['page'] ?? 1);
$perPage = ProductQuery::perPage($_GET['per_page'] ?? null);
$offset = ($page - 1) * $perPage;

$countStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM products p
     LEFT JOIN shops s ON s.id = p.shop_id
     WHERE {$whereSql}"
);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$sql = "SELECT p.id, p.category_id, p.shop_id, p.name, p.slug, p.description, p.price, p.compare_at_price,
               p.rating_avg, p.rating_count, p.badge_label, p.is_featured, p.is_flash_deal,
               p.stock_qty, p.units_sold, p.images, p.tags, p.is_preorder, p.origin_country, p.estimated_arrival_days,
               p.status, p.listing_status, p.created_at,
               s.name AS shop_name, s.slug AS shop_slug, s.logo_url AS shop_logo
        FROM products p
        LEFT JOIN shops s ON s.id = p.shop_id
        WHERE {$whereSql}
        ORDER BY {$orderBy}
        LIMIT {$perPage} OFFSET {$offset}";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$data = array_map(
    static fn (array $row): array => ProductPresenter::summary($row),
    $stmt->fetchAll()
);

if ($term !== '') {
    $log = $pdo->prepare(
        "INSERT INTO search_logs (user_id, query, results_count, search_type) VALUES (NULL, ?, ?, 'text')"
    );
    $log->execute([$term, $total]);
}

Response::success([
    'data' => $data,
    'meta' => [
        'total' => $total,
        'page'  => $page,
        'pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 1,
        'query' => $term,
    ],
]);
