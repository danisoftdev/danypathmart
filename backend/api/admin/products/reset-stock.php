<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AdminProductFilters;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$body = Response::body();
$confirm = trim((string) ($body['confirm'] ?? ''));
if ($confirm !== 'RESET') {
    Response::error('Type RESET to confirm inventory reset.', 422, ['code' => 'confirm_required']);
}

$query = [
    'search'       => $body['search'] ?? ($_GET['search'] ?? ''),
    'status'       => $body['status'] ?? ($_GET['status'] ?? ''),
    'category_id'  => $body['category_id'] ?? ($_GET['category_id'] ?? ''),
    'stock_status' => $body['stock_status'] ?? ($_GET['stock_status'] ?? ''),
];

$pdo = Database::pdo();
$matched = AdminProductFilters::countMatching($pdo, $query, true);
if ($matched === 0) {
    Response::success([
        'updated' => 0,
        'matched' => 0,
        'message' => 'No DPM products matched the current filters.',
    ]);
}

$f = AdminProductFilters::apply('p', $query, true);
$sql = 'UPDATE products p SET p.stock_qty = 0 WHERE 1=1' . $f['sql'] . ' AND p.stock_qty <> 0';
$stmt = $pdo->prepare($sql);
$stmt->execute($f['params']);
$updated = $stmt->rowCount();

Response::success([
    'updated' => $updated,
    'matched' => $matched,
    'message' => "Reset stock to 0 for {$updated} product(s).",
]);
