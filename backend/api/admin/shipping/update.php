<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_shipping');

$pdo = Database::pdo();
$body = Response::body();
$percent = isset($body['local_delivery_base_percent']) ? (float) $body['local_delivery_base_percent'] : null;

if ($percent === null || $percent < 0 || $percent > 100) {
    Response::error('local_delivery_base_percent must be between 0 and 100.', 422);
}

$row = $pdo->query('SELECT id FROM shipping_settings ORDER BY id DESC LIMIT 1')->fetch();
if ($row === false) {
    $pdo->prepare(
        'INSERT INTO shipping_settings (local_delivery_base_percent, updated_by) VALUES (?, ?)'
    )->execute([$percent, (int) $user['id']]);
} else {
    $pdo->prepare(
        'UPDATE shipping_settings SET local_delivery_base_percent = ?, updated_by = ? WHERE id = ?'
    )->execute([$percent, (int) $user['id'], (int) $row['id']]);
}

Response::success([
    'message'  => 'Shipping settings updated.',
    'settings' => ['local_delivery_base_percent' => $percent],
]);
