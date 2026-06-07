<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\FinancialReport;
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

$financial = FinancialReport::build($pdo);
$rev = $financial['revenue'];
$ded = $financial['deductions'];
$int = $financial['interest'];
$inv = $financial['inventory'];

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="danypathmart-reports-' . date('Y-m-d') . '.csv"');
header('Cache-Control: no-store');
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');

$section = static function ($out, string $title, array $rows): void {
    fputcsv($out, [$title, '']);
    foreach ($rows as $row) {
        fputcsv($out, $row);
    }
    fputcsv($out, ['', '']);
};

$section($out, 'SUMMARY', [
    ['orders_total', $ordersTotal],
    ['revenue_paid', number_format($revenue, 2, '.', '')],
    ['pending_orders', $pendingOrders],
    ['customers_total', $customers],
    ['products_active', $products],
    ['net_interest', number_format($int['net_interest'], 2, '.', '')],
    ['currency', 'GHS'],
]);

$section($out, 'REVENUE', [
    ['gross_sales', number_format($rev['gross_sales'], 2, '.', '')],
    ['intl_shipping_collected', number_format($rev['intl_shipping_collected'], 2, '.', '')],
    ['local_delivery_collected', number_format($rev['local_delivery_collected'], 2, '.', '')],
    ['shipping_collected', number_format($rev['shipping_collected'], 2, '.', '')],
    ['total_collected', number_format($rev['total_collected'], 2, '.', '')],
    ['paid_orders', $financial['paid_orders']],
    ['units_sold', $financial['units_sold']],
]);

$section($out, 'DEDUCTIONS', [
    ['product_cost', number_format($ded['product_cost'], 2, '.', '')],
    ['cbm_cost', number_format($ded['cbm_cost'], 2, '.', '')],
    ['total_deductions', number_format($ded['total'], 2, '.', '')],
]);

$section($out, 'INTEREST', [
    ['product_interest', number_format($int['product_interest'], 2, '.', '')],
    ['net_interest', number_format($int['net_interest'], 2, '.', '')],
]);

$section($out, 'INVENTORY', [
    ['units_on_hand', $inv['units_on_hand']],
    ['active_skus', $inv['active_skus']],
    ['low_stock_skus', $inv['low_stock_skus']],
    ['out_of_stock_skus', $inv['out_of_stock_skus']],
    ['cost_value', number_format($inv['cost_value'], 2, '.', '')],
    ['retail_value', number_format($inv['retail_value'], 2, '.', '')],
    ['potential_interest', number_format($inv['potential_interest'], 2, '.', '')],
]);

fputcsv($out, ['RECENT_PAID_ORDERS', '', '', '']);
fputcsv($out, ['order_id', 'created_at', 'subtotal', 'total']);
foreach ($financial['recent_sales'] as $row) {
    fputcsv($out, [
        $row['id'],
        $row['created_at'],
        number_format($row['subtotal'], 2, '.', ''),
        number_format($row['total'], 2, '.', ''),
    ]);
}

fclose($out);
exit;
