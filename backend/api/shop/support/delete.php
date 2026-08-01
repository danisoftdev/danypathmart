<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid conversation.', 422);
}

$pdo = Database::pdo();
if (!SupportChatService::deleteForShop($pdo, $id, (int) $ctx['shop_id'])) {
    Response::error('Conversation not found.', 404);
}

Response::success(['message' => 'Chat deleted.']);
