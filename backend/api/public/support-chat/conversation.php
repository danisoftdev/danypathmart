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

// Never return a successful empty thread for guests — that was wiping the
// logged-in chat UI when a poll briefly lacked auth.
if ($user === null) {
    Response::error('Sign in to load your chat.', 403, ['code' => 'account_required']);
}

try {
    $thread = SupportChatService::loadCustomerThread($pdo, $user, null, $sinceId);
} catch (Throwable $e) {
    error_log('public/support-chat: ' . $e->getMessage());
    Response::error('Could not load chat.', 500);
}

$conversation = $thread['conversation'];

Response::success([
    'conversation'  => $conversation,
    'messages'      => $thread['messages'],
    'needs_routing' => is_array($conversation) && ($conversation['routed_to'] ?? 'pending') === 'pending',
]);
