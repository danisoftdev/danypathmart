<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();

$body = Response::body();
$id = (int) ($body['conversation_id'] ?? 0);
$text = isset($body['body']) ? trim((string) $body['body']) : null;
$imageUrl = isset($body['image_url']) ? trim((string) $body['image_url']) : null;
if ($text === '') {
    $text = null;
}
if ($imageUrl === '') {
    $imageUrl = null;
}

if ($id <= 0 || ($text === null && $imageUrl === null)) {
    Response::error('conversation_id and a message or image are required.', 422);
}

$pdo = Database::pdo();
$conv = SupportChatService::requireConversationPublic($pdo, $id);
if ((int) ($conv['shop_id'] ?? 0) !== (int) $ctx['shop_id'] || ($conv['routed_to'] ?? '') !== 'shop') {
    Response::error('Conversation not found.', 404);
}

try {
    $msg = SupportChatService::sendShopMessage($pdo, $id, (int) $ctx['user']['id'], $text, $imageUrl);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => $msg], 201);
