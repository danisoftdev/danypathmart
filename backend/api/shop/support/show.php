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
$conv = SupportChatService::requireConversationPublic($pdo, $id);
if ((int) ($conv['shop_id'] ?? 0) !== (int) $ctx['shop_id'] || ($conv['routed_to'] ?? '') !== 'shop') {
    Response::error('Conversation not found.', 404);
}

SupportChatService::markShopRead($pdo, $id);

Response::success([
    'conversation' => SupportChatService::requireConversationPublic($pdo, $id),
    'messages'     => SupportChatService::listMessages($pdo, $id),
]);
