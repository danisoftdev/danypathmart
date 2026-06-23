<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\ProductQuery;
use App\Helpers\Response;

$pdo = Database::pdo();

[$whereSql, $params] = ProductQuery::filters($_GET);
[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, null);
$whereSql = preg_replace('/\bstatus\b/', 'p.status', $whereSql);
$whereSql = $whereSql . ' AND ' . $marketSql;
$params = array_merge($params, $marketParams);

$orderBy = ProductQuery::orderBy(isset($_GET['sort']) ? (string) $_GET['sort'] : null);
$page = ProductQuery::page($_GET['page'] ?? 1);
$perPage = ProductQuery::perPage($_GET['per_page'] ?? null);
$offset = ($page - 1) * $perPage;

$countStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN shops s ON s.id = p.shop_id
     WHERE {$whereSql}"
);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// LIMIT/OFFSET are validated integers, safe to inline (native prepares reject
// string-bound LIMIT params when emulation is off).
$sql = "SELECT p.id, p.category_id, p.shop_id, p.name, p.slug, p.description, p.price, p.compare_at_price,
               p.rating_avg, p.rating_count, p.badge_label, p.is_featured, p.is_flash_deal,
               p.stock_qty, p.units_sold, p.images, p.tags, p.is_preorder, p.origin_country, p.estimated_arrival_days,
               p.status, p.listing_status, p.created_at,
               c.name AS category_name, c.slug AS category_slug,
               s.name AS shop_name, s.slug AS shop_slug, s.logo_url AS shop_logo
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
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

Response::success([
    'data' => $data,
    'meta' => [
        'total' => $total,
        'page'  => $page,
        'pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 1,
    ],
]);
