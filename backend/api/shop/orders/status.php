<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopFulfillmentService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid order.', 422);
}

$body = Response::body();
$status = trim((string) ($body['status'] ?? ''));
$note = isset($body['note']) ? trim((string) $body['note']) : null;

try {
    ShopFulfillmentService::updateStatus(
        Database::pdo(),
        $ctx['shop_id'],
        $id,
        $status,
        (int) $ctx['user']['id'],
        $note
    );
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Delivery status updated.']);
