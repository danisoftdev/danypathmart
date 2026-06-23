<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportBotService;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$guestToken = SupportChatService::guestTokenFromRequest();
$body = Response::body();
$nodeKey = trim((string) ($body['node_key'] ?? ''));
$conversationId = (int) ($body['conversation_id'] ?? 0);

if ($nodeKey === '' || $conversationId <= 0) {
    Response::error('node_key and conversation_id required.', 422);
}

$conv = SupportChatService::requireConversationPublic($pdo, $conversationId);
SupportChatService::assertCustomerAccess($user, $guestToken, $conv);

$product = null;
if (!empty($conv['product_id'])) {
    $stmt = $pdo->prepare('SELECT id, name, stock_qty, is_preorder, shop_id FROM products WHERE id = ?');
    $stmt->execute([(int) $conv['product_id']]);
    $product = $stmt->fetch() ?: null;
    if ($product !== null) {
        $product['is_preorder'] = (int) ($product['is_preorder'] ?? 0) === 1;
    }
}

try {
    $result = SupportBotService::handleChoice($pdo, $conversationId, $nodeKey, $product ?: null);
} catch (Throwable $e) {
    Response::error($e->getMessage(), 422);
}

Response::success($result);
