<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductReviewService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_product_reviews');

$body = Response::body();
$id = (int) ($body['review_id'] ?? 0);
$status = trim((string) ($body['status'] ?? ''));

if ($id <= 0) {
    Response::error('review_id required.', 422);
}

try {
    ProductReviewService::moderate(Database::pdo(), $id, $status);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Review updated.']);
