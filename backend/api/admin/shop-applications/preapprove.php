<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopApplicationService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('create_shop_preapproved');

$pdo = Database::pdo();
$body = Response::body();
$user = AuthMiddleware::getUser() ?? AuthMiddleware::authenticate();

try {
    $result = ShopApplicationService::createPreapproved($pdo, $body, (int) $user['id']);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create pre-approved application.', 500);
}

Response::success([
    'message'     => !empty($result['shop'])
        ? 'Pre-approved application created and shop approved.'
        : 'Pre-approved application created.',
    'application' => $result['application'],
    'shop'        => $result['shop'],
], 201);
