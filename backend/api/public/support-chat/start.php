<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportBotService;
use App\Helpers\SupportChatService;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$guestToken = SupportChatService::guestTokenFromRequest();
$body = Response::body();

$productId = isset($body['product_id']) ? (int) $body['product_id'] : null;
$orderId = isset($body['order_id']) ? (int) $body['order_id'] : null;
$name = trim((string) ($body['name'] ?? ($user['name'] ?? '')));
$email = trim((string) ($body['email'] ?? ($user['email'] ?? '')));

if ($user !== null) {
    $email = trim((string) ($user['email'] ?? ''));
    if ($email === '' || !Validator::email($email)) {
        Response::error('Your account needs a valid email before starting live chat.', 422);
    }
    $conversation = SupportChatService::startWithContext(
        $pdo,
        $user,
        null,
        $name !== '' ? $name : 'Customer',
        $email,
        $productId,
        $orderId
    );
    $options = SupportBotService::children($pdo, 'root');
    Response::success(['conversation' => $conversation, 'guest_token' => null, 'bot_options' => $options], 201);
}

if ($guestToken === null) {
    Response::error('Guest token required.', 422, ['code' => 'guest_token_required']);
}
if ($name === '') {
    Response::error('Please enter your name.', 422);
}
if ($email === '' || !Validator::email($email)) {
    Response::error('Please enter a valid email address.', 422);
}

try {
    $conversation = SupportChatService::startWithContext($pdo, null, $guestToken, $name, $email, $productId, $orderId);
} catch (Throwable $e) {
    Response::error('Could not start chat.', 500);
}

Response::success([
    'conversation' => $conversation,
    'guest_token'  => $guestToken,
    'bot_options'  => SupportBotService::children($pdo, 'root'),
], 201);
