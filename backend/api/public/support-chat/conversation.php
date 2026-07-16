<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$guestToken = SupportChatService::guestTokenFromRequest();
$sinceId = isset($_GET['since_message_id']) ? (int) $_GET['since_message_id'] : null;
if ($sinceId !== null && $sinceId <= 0) {
    $sinceId = null;
}

if ($user === null && $guestToken === null) {
    Response::error('Sign in or continue as guest to load your chat.', 403, ['code' => 'account_required']);
}

try {
    $thread = SupportChatService::loadCustomerThread($pdo, $user, $guestToken, $sinceId);
} catch (Throwable $e) {
    error_log('public/support-chat: ' . $e->getMessage());
    Response::error('Could not load chat.', 500);
}

$conversation = $thread['conversation'];

Response::success([
    'conversation'  => $conversation,
    'messages'      => $thread['messages'],
    'guest_token'   => $user === null ? $guestToken : null,
    'is_guest'      => $user === null,
    'needs_routing' => is_array($conversation) && ($conversation['routed_to'] ?? 'pending') === 'pending',
]);
