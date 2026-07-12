<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingReceiptService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$paymentId = (int) ($_GET['id'] ?? 0);
if ($paymentId <= 0) {
    Response::error('Receipt id is required.', 422);
}

$receipt = ShopBillingReceiptService::findByIdForShop($pdo, $paymentId, $ctx['shop_id']);
if ($receipt === null) {
    Response::error('Receipt not found.', 404);
}

Response::success(['receipt' => $receipt]);
