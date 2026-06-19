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

if ($user !== null) {
    $existing = SupportChatService::findOpenForUser($pdo, (int) $user['id']);
    if ($existing === null) {
        $name = trim((string) ($user['name'] ?? 'Customer'));
        $email = trim((string) ($user['email'] ?? ''));
        if ($email === '' || !Validator::email($email)) {
            Response::error('Your account needs a valid email before starting live chat.', 422);
        }
        $conversation = SupportChatService::createForUser($pdo, (int) $user['id'], $name, $email);
    } else {
        $conversation = $existing;
    }

    Response::success([
        'conversation' => $conversation,
        'guest_token'  => null,
    ], 201);
}

if ($guestToken === null) {
    Response::error('Guest token required.', 422, ['code' => 'guest_token_required']);
}

$body = Response::body();
$name = trim((string) ($body['name'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));

if ($name === '') {
    Response::error('Please enter your name.', 422);
}
if ($email === '' || !Validator::email($email)) {
    Response::error('Please enter a valid email address.', 422);
}

try {
    $conversation = SupportChatService::startGuest($pdo, $guestToken, $name, $email);
} catch (Throwable $e) {
    Response::error('Could not start chat.', 500);
}

Response::success([
    'conversation' => $conversation,
    'guest_token'  => $guestToken,
], 201);
