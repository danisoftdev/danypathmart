<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosBarcodeService;
use App\Helpers\PosGate;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageConfig($user);

$body = Response::body();
$ids = null;
if (isset($body['product_ids']) && is_array($body['product_ids'])) {
    $ids = array_map('intval', $body['product_ids']);
} elseif (isset($_GET['product_ids']) && is_string($_GET['product_ids'])) {
    $ids = array_map('intval', explode(',', $_GET['product_ids']));
}

Response::success(['data' => PosBarcodeService::labelData($pdo, $ids)]);
