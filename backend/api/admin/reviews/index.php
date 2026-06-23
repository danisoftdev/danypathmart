<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductReviewService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_product_reviews', 'view_products']);

Response::success(['data' => ProductReviewService::listPending(Database::pdo())]);
