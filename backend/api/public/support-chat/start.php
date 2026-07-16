<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::optional();
$guestToken = SupportChatService::guestTokenFromRequest();
$body = Response::body();

$productId = isset($body['product_id']) ? (int) $body['product_id'] : null;
$orderId = isset($body['order_id']) ? (int) $body['order_id'] : null;

try {
    if ($user !== null) {
        $name = trim((string) ($user['name'] ?? ''));
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
        Response::success([
            'conversation'  => $conversation,
            'guest_token'   => null,
            'is_guest'      => false,
            'needs_routing' => ($conversation['routed_to'] ?? 'pending') === 'pending',
        ], 201);
    }

    // Guest chat — persisted so DPM can see and reply.
    if ($guestToken === null) {
        Response::error('Guest token required.', 422, ['code' => 'guest_token_required']);
    }
    $name = trim((string) ($body['name'] ?? ''));
    $email = trim((string) ($body['email'] ?? ''));
    if ($name === '') {
        Response::error('Please enter your name.', 422);
    }
    if ($email === '' || !Validator::email($email)) {
        Response::error('Please enter a valid email address.', 422);
    }

    $conversation = SupportChatService::startWithContext(
        $pdo,
        null,
        $guestToken,
        $name,
        $email,
        $productId,
        $orderId
    );
} catch (Throwable $e) {
    error_log('public/support-chat/start: ' . $e->getMessage());
    Response::error('Could not start chat. ' . $e->getMessage(), 500);
}

Response::success([
    'conversation'  => $conversation,
    'guest_token'   => $guestToken,
    'is_guest'      => true,
    'needs_routing' => ($conversation['routed_to'] ?? 'pending') === 'pending',
], 201);
