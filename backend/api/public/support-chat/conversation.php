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
$sinceId = isset($_GET['since_message_id']) ? (int) $_GET['since_message_id'] : null;
if ($sinceId !== null && $sinceId <= 0) {
    $sinceId = null;
}

$thread = SupportChatService::loadCustomerThread($pdo, $user, $guestToken, $sinceId);
$conversation = $thread['conversation'];
$botOptions = [];
if (is_array($conversation) && (($conversation['status'] ?? '') === 'open')) {
    $routed = (string) ($conversation['routed_to'] ?? 'pending');
    if ($routed === 'pending' || $routed === '') {
        $step = trim((string) ($conversation['bot_step_key'] ?? ''));
        $botOptions = SupportBotService::children($pdo, $step !== '' ? $step : 'root');
    }
}

Response::success([
    'conversation' => $conversation,
    'messages'     => $thread['messages'],
    'guest_token'  => $guestToken,
    'bot_options'  => $botOptions,
]);
