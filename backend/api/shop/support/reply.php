<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();

$body = Response::body();
$id = (int) ($body['conversation_id'] ?? 0);
$text = trim((string) ($body['body'] ?? ''));

if ($id <= 0 || $text === '') {
    Response::error('conversation_id and body required.', 422);
}

$conv = SupportChatService::requireConversationPublic(Database::pdo(), $id);
if ((int) ($conv['shop_id'] ?? 0) !== $ctx['shop_id'] || ($conv['routed_to'] ?? '') !== 'shop') {
    Response::error('Conversation not found.', 404);
}

try {
    $msg = SupportChatService::sendShopMessage(Database::pdo(), $id, (int) $ctx['user']['id'], $text);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => $msg]);
