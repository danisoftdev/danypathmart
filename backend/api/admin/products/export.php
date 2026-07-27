<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AdminProductFilters;
use App\Helpers\CsvExportHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_products');

$pdo = Database::pdo();

$columnsParam = trim((string) ($_GET['columns'] ?? ''));

$allColumns = [
    'id',
    'name',
    'slug',
    'barcode',
    'category',
    'price',
    'cost_price',
    'compare_at_price',
    'stock_qty',
    'status',
    'is_preorder',
    'is_featured',
    'is_flash_deal',
    'origin_country',
    'estimated_arrival_days',
    'rating_avg',
    'rating_count',
    'badge_label',
    'tags',
    'created_at',
];

$sql = 'SELECT p.id, p.name, p.slug, p.barcode, p.price, p.cost_price, p.compare_at_price, p.stock_qty,
               p.status, p.is_preorder, p.is_featured, p.is_flash_deal, p.origin_country,
               p.estimated_arrival_days, p.rating_avg, p.rating_count, p.badge_label, p.tags,
               p.created_at, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE 1=1';

$filters = AdminProductFilters::apply('p', [
    'search'       => $_GET['search'] ?? '',
    'status'       => $_GET['status'] ?? '',
    'category_id'  => $_GET['category_id'] ?? '',
    'stock_status' => $_GET['stock_status'] ?? '',
], true);

$sql .= $filters['sql'];
$params = $filters['params'];
$sql .= ' ORDER BY p.name ASC LIMIT 10000';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$rows = [];
foreach ($stmt->fetchAll() as $row) {
    $tags = json_decode((string) ($row['tags'] ?? ''), true);
    $tagStr = is_array($tags) ? implode('; ', $tags) : '';

    $rows[] = [
        'id'                     => (int) $row['id'],
        'name'                   => $row['name'],
        'slug'                   => $row['slug'],
        'barcode'                => $row['barcode'] ?? '',
        'category'               => $row['category_name'] ?? '',
        'price'                  => number_format((float) $row['price'], 2, '.', ''),
        'cost_price'             => number_format((float) $row['cost_price'], 2, '.', ''),
        'compare_at_price'       => $row['compare_at_price'] !== null
            ? number_format((float) $row['compare_at_price'], 2, '.', '')
            : '',
        'stock_qty'              => (int) $row['stock_qty'],
        'status'                 => $row['status'],
        'is_preorder'            => (int) $row['is_preorder'] === 1 ? 'yes' : 'no',
        'is_featured'            => (int) $row['is_featured'] === 1 ? 'yes' : 'no',
        'is_flash_deal'          => (int) $row['is_flash_deal'] === 1 ? 'yes' : 'no',
        'origin_country'         => $row['origin_country'] ?? '',
        'estimated_arrival_days' => $row['estimated_arrival_days'] ?? '',
        'rating_avg'             => $row['rating_avg'] ?? '',
        'rating_count'           => (int) $row['rating_count'],
        'badge_label'            => $row['badge_label'] ?? '',
        'tags'                   => $tagStr,
        'created_at'             => $row['created_at'],
    ];
}

$columns = CsvExportHelper::resolveColumns($allColumns, $columnsParam ?: null);
$out = CsvExportHelper::beginDownload('danypathmart-products-' . date('Y-m-d') . '.csv');
CsvExportHelper::writeRows($out, $columns, $rows);
fclose($out);
exit;
