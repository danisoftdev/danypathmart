<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$body = Response::body();

// Persisted live chat requires an account. Guests use ephemeral client-only chat.
if ($user === null) {
    Response::error(
        'Sign in to chat with support. You can continue without an account, but that chat is not saved.',
        401,
        ['code' => 'account_required']
    );
}

$productId = isset($body['product_id']) ? (int) $body['product_id'] : null;
$orderId = isset($body['order_id']) ? (int) $body['order_id'] : null;
$name = trim((string) ($user['name'] ?? ''));
$email = trim((string) ($user['email'] ?? ''));

try {
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
} catch (Throwable $e) {
    error_log('public/support-chat/start: ' . $e->getMessage());
    Response::error('Could not start chat. ' . $e->getMessage(), 500);
}

Response::success([
    'conversation' => $conversation,
    'guest_token'  => null,
    'needs_routing' => ($conversation['routed_to'] ?? 'pending') === 'pending',
], 201);
