<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('waive_shop_fees');

$pdo = Database::pdo();
$body = Response::body();

$shopId = (int) ($body['shop_id'] ?? 0);
$note = trim((string) ($body['note'] ?? ''));
$until = trim((string) ($body['until'] ?? ''));

if ($shopId <= 0) {
    Response::error('Shop id is required.', 422);
}

$untilDate = $until !== '' ? $until : null;
if ($untilDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $untilDate)) {
    Response::error('Until date must be YYYY-MM-DD.', 422);
}

try {
    ShopBillingService::waiveShopSubscription(
        $pdo,
        $shopId,
        (int) $user['id'],
        $note !== '' ? $note : null,
        $untilDate
    );
} catch (\Throwable) {
    Response::error('Could not waive shop renewal.', 500);
}

Response::success(['message' => 'Shop renewal waived.']);
