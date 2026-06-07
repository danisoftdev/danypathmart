<?php

declare(strict_types=1);

use App\Helpers\CsvExportHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_products');

$columns = [
    'slug',
    'name',
    'price',
    'cost_price',
    'stock_qty',
    'status',
    'category',
    'tags',
    'is_preorder',
    'compare_at_price',
    'badge_label',
];

$example = [
    'slug'             => 'youth-pathfinder-scarf',
    'name'             => 'Youth Pathfinder Scarf',
    'price'            => '45.00',
    'cost_price'       => '28.00',
    'stock_qty'        => 25,
    'status'           => 'active',
    'category'         => 'Uniforms',
    'tags'             => 'pathfinder; youth',
    'is_preorder'      => 'no',
    'compare_at_price' => '55.00',
    'badge_label'      => 'New',
];

$out = CsvExportHelper::beginDownload('danypathmart-products-import-template.csv');
CsvExportHelper::writeRows($out, $columns, [$example]);
fclose($out);
exit;
