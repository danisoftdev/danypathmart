<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\FlashSaleSettings;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

$pdo = Database::pdo();
Response::success(['flash_sale' => FlashSaleSettings::read($pdo)]);
