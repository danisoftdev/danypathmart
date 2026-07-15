<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$user = AuthMiddleware::authenticate();
$body = Response::body();

$text = isset($body['body']) ? trim((string) $body['body']) : null;
$imageUrl = isset($body['image_url']) ? trim((string) $body['image_url']) : null;
if ($text === '') {
    $text = null;
}
if ($imageUrl === '') {
    $imageUrl = null;
}

try {
    $message = SupportChatService::sendCustomerMessage($pdo, $user, null, $text, $imageUrl);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('support-chat message: ' . $e->getMessage());
    Response::error('Could not send message.', 500);
}

Response::success(['message' => $message], 201);
