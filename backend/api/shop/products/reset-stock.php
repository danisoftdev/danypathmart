<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AdminProductFilters;
use App\Helpers\Response;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$body = Response::body();

$confirm = trim((string) ($body['confirm'] ?? ''));
if ($confirm !== 'RESET') {
    Response::error('Type RESET to confirm inventory reset.', 422, ['code' => 'confirm_required']);
}

$shopId = (int) $ctx['shop_id'];
$query = [
    'search'       => $body['search'] ?? '',
    'status'       => $body['status'] ?? '',
    'category_id'  => $body['category_id'] ?? '',
    'stock_status' => $body['stock_status'] ?? '',
];

$pdo = Database::pdo();
$filters = AdminProductFilters::apply('p', $query, false);

$countSql = 'SELECT COUNT(*) FROM products p WHERE p.shop_id = ?' . $filters['sql'];
$countStmt = $pdo->prepare($countSql);
$countStmt->execute(array_merge([$shopId], $filters['params']));
$matched = (int) $countStmt->fetchColumn();

if ($matched === 0) {
    Response::success([
        'updated' => 0,
        'matched' => 0,
        'message' => 'No products in your shop matched the current filters.',
    ]);
}

$updateSql = 'UPDATE products p SET p.stock_qty = 0 WHERE p.shop_id = ?' . $filters['sql'] . ' AND p.stock_qty <> 0';
$upd = $pdo->prepare($updateSql);
$upd->execute(array_merge([$shopId], $filters['params']));
$updated = $upd->rowCount();

Response::success([
    'updated' => $updated,
    'matched' => $matched,
    'message' => "Reset stock to 0 for {$updated} product(s) in your shop.",
]);
