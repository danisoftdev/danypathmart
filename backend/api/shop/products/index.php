<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AdminProductFilters;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$shopId = (int) $ctx['shop_id'];

$query = [
    'search'       => $_GET['search'] ?? '',
    'status'       => $_GET['status'] ?? '',
    'category_id'  => $_GET['category_id'] ?? '',
    'stock_status' => $_GET['stock_status'] ?? '',
];

$filters = AdminProductFilters::apply('p', $query, false);

$sql = 'SELECT p.*, c.name AS category_name, c.slug AS category_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.shop_id = ?' . $filters['sql'];
$params = array_merge([$shopId], $filters['params']);

$inventoryMode = trim((string) ($_GET['inventory'] ?? '')) === '1';
$limit = $inventoryMode ? 10000 : 500;
$sql .= ' ORDER BY p.name ASC LIMIT ' . $limit;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

Response::success([
    'data' => array_map(static function (array $r): array {
        $row = ProductPresenter::summary($r) + [
            'listing_status' => $r['listing_status'] ?? 'none',
            'status'         => $r['status'],
            'category_name'  => $r['category_name'] ?? null,
            'description'    => $r['description'] ?? null,
        ];
        if (array_key_exists('listing_admin_note', $r)) {
            $row['listing_admin_note'] = $r['listing_admin_note'];
        }
        return $row;
    }, $stmt->fetchAll()),
]);
