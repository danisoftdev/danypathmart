<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductReviewService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

try {
    $review = ProductReviewService::submit(Database::pdo(), (int) $user['id'], Response::body());
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['review' => $review, 'message' => 'Review submitted for moderation.'], 201);
