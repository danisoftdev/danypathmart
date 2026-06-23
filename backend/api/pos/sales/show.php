<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosReceiptService;
use App\Helpers\PosSaleService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$orderId = (int) ($_GET['id'] ?? 0);
$sale = PosSaleService::find($pdo, $orderId);
if ($sale === null) {
    Response::error('Sale not found.', 404);
}

Response::success(['sale' => $sale, 'receipt' => PosReceiptService::build($pdo, $orderId)]);
