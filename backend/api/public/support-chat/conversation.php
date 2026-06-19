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

$thread = SupportChatService::loadCustomerThread($pdo, $user, $guestToken, $sinceId);

Response::success([
    'conversation' => $thread['conversation'],
    'messages'     => $thread['messages'],
    'guest_token'  => $guestToken,
]);
