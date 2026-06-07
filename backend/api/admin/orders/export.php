<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CsvExportHelper;
use App\Helpers\OrdersCsvBuilder;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();
$status = trim((string) ($_GET['status'] ?? ''));
$search = trim((string) ($_GET['search'] ?? ''));
$columnsParam = trim((string) ($_GET['columns'] ?? ''));

$result = OrdersCsvBuilder::fetch($pdo, ['status' => $status, 'search' => $search]);
$columns = CsvExportHelper::resolveColumns(OrdersCsvBuilder::COLUMNS, $columnsParam ?: null);

$out = CsvExportHelper::beginDownload('danypathmart-orders-' . date('Y-m-d') . '.csv');
CsvExportHelper::writeRows($out, $columns, $result['rows']);
fclose($out);
exit;
