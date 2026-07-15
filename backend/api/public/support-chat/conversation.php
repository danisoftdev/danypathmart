<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$sinceId = isset($_GET['since_message_id']) ? (int) $_GET['since_message_id'] : null;
if ($sinceId !== null && $sinceId <= 0) {
    $sinceId = null;
}

// Guest / ephemeral chats are not persisted — only signed-in users load a server thread.
if ($user === null) {
    Response::success([
        'conversation'  => null,
        'messages'      => [],
        'guest_token'   => null,
        'needs_routing' => false,
        'ephemeral'     => true,
    ]);
}

$thread = SupportChatService::loadCustomerThread($pdo, $user, null, $sinceId);
$conversation = $thread['conversation'];

Response::success([
    'conversation'  => $conversation,
    'messages'      => $thread['messages'],
    'guest_token'   => null,
    'needs_routing' => is_array($conversation) && ($conversation['routed_to'] ?? 'pending') === 'pending',
]);
