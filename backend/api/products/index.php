<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\ProductQuery;
use App\Helpers\Response;

$pdo = Database::pdo();

[$whereSql, $params] = ProductQuery::filters($_GET);
$orderBy = ProductQuery::orderBy(isset($_GET['sort']) ? (string) $_GET['sort'] : null);
$page = ProductQuery::page($_GET['page'] ?? 1);
$perPage = ProductQuery::perPage($_GET['per_page'] ?? null);
$offset = ($page - 1) * $perPage;

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE {$whereSql}");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// LIMIT/OFFSET are validated integers, safe to inline (native prepares reject
// string-bound LIMIT params when emulation is off).
$sql = "SELECT id, category_id, name, slug, description, price, stock_qty, images, tags,
               is_preorder, estimated_arrival_days, status, created_at
        FROM products
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
