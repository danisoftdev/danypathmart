<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopInviteService;

$pdo = Database::pdo();
$token = trim((string) ($_GET['token'] ?? ''));

if ($token === '') {
    Response::error('Invite token is required.', 422);
}

try {
    $invite = ShopInviteService::publicShow($pdo, $token);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 404);
} catch (\Throwable) {
    Response::error('Could not load invite.', 500);
}

Response::success(['invite' => $invite]);
