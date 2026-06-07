<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\FinancialReport;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_reports');

$pdo = Database::pdo();

$ordersTotal = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
$revenue = (float) ($pdo->query(
    "SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid'"
)->fetchColumn() ?: 0);
$pendingOrders = (int) $pdo->query(
    "SELECT COUNT(*) FROM orders WHERE status NOT IN ('delivered','cancelled')"
)->fetchColumn();
$customers = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'customer'")->fetchColumn();
$products = (int) $pdo->query("SELECT COUNT(*) FROM products WHERE status = 'active'")->fetchColumn();
$pendingAlerts = (int) $pdo->query(
    "SELECT COUNT(*) FROM image_search_alerts WHERE status = 'pending'"
)->fetchColumn();

$financial = FinancialReport::build($pdo);

Response::success([
    'summary' => [
        'orders_total'    => $ordersTotal,
        'revenue_paid'    => round($revenue, 2),
        'pending_orders'  => $pendingOrders,
        'customers_total' => $customers,
        'products_active' => $products,
        'pending_alerts'  => $pendingAlerts,
        'net_interest'    => $financial['interest']['net_interest'],
        'currency'        => 'GHS',
    ],
]);
