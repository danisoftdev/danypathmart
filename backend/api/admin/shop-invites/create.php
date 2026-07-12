<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopInviteService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('invite_shop_owner');

$pdo = Database::pdo();
$body = Response::body();
$user = AuthMiddleware::getUser() ?? AuthMiddleware::authenticate();

try {
    $invite = ShopInviteService::create($pdo, $body, (int) $user['id']);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not create invite.', 500);
}

Response::success([
    'message'     => 'Invite created and sent.',
    'invite'      => $invite,
    'invite_path' => $invite['invite_path'] ?? ('/sell?invite=' . ($invite['token'] ?? '')),
    'invite_url'  => $invite['invite_url'] ?? null,
], 201);
