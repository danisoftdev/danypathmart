<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\FlashSaleSettings;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
$fields = FlashSaleSettings::validate(Response::body());
FlashSaleSettings::save($pdo, $fields, (int) $user['id']);

Response::success([
    'message'    => 'Flash sale settings saved.',
    'flash_sale' => FlashSaleSettings::read($pdo),
]);
