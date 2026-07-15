<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::authenticate();
$body = Response::body();

$conversationId = (int) ($body['conversation_id'] ?? 0);
$route = strtolower(trim((string) ($body['route'] ?? '')));
$shopId = isset($body['shop_id']) ? (int) $body['shop_id'] : null;

if ($conversationId <= 0) {
    Response::error('conversation_id required.', 422);
}
if (!in_array($route, ['dpm', 'shop'], true)) {
    Response::error('Choose Danypath Mart or a shop.', 422);
}

$conv = SupportChatService::requireConversationPublic($pdo, $conversationId);
SupportChatService::assertCustomerAccess($user, null, $conv);

try {
    $result = SupportChatService::routeCustomerChat($pdo, $conversationId, $route, $shopId);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('public/support-chat/route: ' . $e->getMessage());
    Response::error('Could not connect your chat.', 500);
}

Response::success($result);
