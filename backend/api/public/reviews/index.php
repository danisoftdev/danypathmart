<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductReviewService;
use App\Helpers\Response;

$productId = (int) ($_GET['product_id'] ?? 0);
if ($productId <= 0) {
    Response::error('product_id required.', 422);
}

Response::success(['data' => ProductReviewService::listForProduct(Database::pdo(), $productId)]);
