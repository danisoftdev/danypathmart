<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopApplicationService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$body = Response::body();
$user = AuthMiddleware::optional();

try {
    $app = ShopApplicationService::submit($pdo, $body, $user !== null ? (int) $user['id'] : null);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not submit application.', 500);
}

Response::success([
    'message' => $app['requires_payment'] ?? false
        ? 'Application received. Pay the registration fee to complete your submission.'
        : 'Application received. We will review and email you.',
    'application' => $app,
    'requires_payment' => (bool) ($app['requires_payment'] ?? false),
], 201);
