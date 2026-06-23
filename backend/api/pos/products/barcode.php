<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosProductService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$code = trim((string) ($_GET['code'] ?? ''));
if ($code === '') {
    Response::error('Barcode is required.', 422);
}

$product = PosProductService::findByBarcode($pdo, $code);
if ($product === null) {
    Response::error('No product found for this barcode.', 404, ['code' => 'not_found']);
}

Response::success(['data' => $product]);
