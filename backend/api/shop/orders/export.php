<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CsvExportHelper;
use App\Helpers\ShopSalesCsvBuilder;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$view = strtolower(trim((string) ($_GET['view'] ?? 'orders')));
if (!in_array($view, ['orders', 'items'], true)) {
    $view = 'orders';
}

$result = ShopSalesCsvBuilder::fetch($pdo, $ctx['shop_id'], [
    'view'   => $view,
    'since'  => trim((string) ($_GET['since'] ?? '')),
    'status' => trim((string) ($_GET['status'] ?? '')),
]);

$slug = preg_replace('/[^a-z0-9-]+/i', '-', (string) ($ctx['shop']['slug'] ?? 'shop')) ?: 'shop';
$filename = sprintf('%s-sales-%s-%s.csv', $slug, $view, date('Y-m-d'));

$out = CsvExportHelper::beginDownload($filename);
CsvExportHelper::writeRows($out, $result['columns'], $result['rows']);
fclose($out);
exit;
