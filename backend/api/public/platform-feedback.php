<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductReviewService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::optional();

try {
    ProductReviewService::submitPlatformFeedback(Database::pdo(), $user ? (int) $user['id'] : null, Response::body());
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Thank you for your feedback.']);
