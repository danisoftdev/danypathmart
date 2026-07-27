<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\AdminProductFilters;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_products');

$pdo = Database::pdo();

$search = trim((string) ($_GET['search'] ?? ''));
$status = trim((string) ($_GET['status'] ?? ''));
$categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== ''
    ? (int) $_GET['category_id']
    : 0;

$sql = 'SELECT p.id, p.category_id, p.name, p.slug, p.barcode, p.description, p.price, p.cost_price, p.compare_at_price,
               p.rating_avg, p.rating_count, p.badge_label, p.is_featured, p.is_flash_deal, p.stock_qty,
               p.images, p.tags, p.is_preorder, p.origin_country, p.estimated_arrival_days, p.status, p.created_at,
               c.name AS category_name, c.slug AS category_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE 1=1';

$filters = AdminProductFilters::apply('p', [
    'search'       => $search,
    'status'       => $status,
    'category_id'  => $categoryId,
    'stock_status' => $_GET['stock_status'] ?? '',
    'is_flash_deal'=> $_GET['is_flash_deal'] ?? '',
], true);

$sql .= $filters['sql'];
$params = $filters['params'];

$inventoryMode = trim((string) ($_GET['inventory'] ?? '')) === '1';
$limit = $inventoryMode ? 10000 : 200;
$sql .= ' ORDER BY p.name ASC LIMIT ' . $limit;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$data = array_map(
    static fn (array $row): array => ProductPresenter::summary($row) + [
        'status'                 => $row['status'],
        'description'            => $row['description'],
        'origin_country'         => $row['origin_country'],
        'estimated_arrival_days' => $row['estimated_arrival_days'] !== null ? (int) $row['estimated_arrival_days'] : null,
        'category_name'          => $row['category_name'] ?? null,
    ],
    $stmt->fetchAll()
);

Response::success(['data' => $data]);
