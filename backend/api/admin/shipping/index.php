<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShippingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_shipping');

$pdo = Database::pdo();
$settings = ShippingService::settings($pdo);

$row = $pdo->query(
    'SELECT id, local_delivery_base_percent, updated_at FROM shipping_settings ORDER BY id DESC LIMIT 1'
)->fetch();

Response::success([
    'settings' => [
        'id'                         => $row !== false ? (int) $row['id'] : null,
        'local_delivery_base_percent'  => $settings['local_delivery_percent'],
        'usd_to_ghs_rate'            => $settings['usd_to_ghs_rate'],
        'updated_at'                 => $row['updated_at'] ?? null,
    ],
]);
