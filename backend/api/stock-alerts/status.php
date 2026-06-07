<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\RestockAlertService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$productId = (int) ($_GET['product_id'] ?? 0);
if ($productId <= 0) {
    Response::error('Product is required.', 422);
}

$rows = RestockAlertService::status(Database::pdo(), (int) $user['id'], $productId);

Response::success(['subscriptions' => $rows]);
