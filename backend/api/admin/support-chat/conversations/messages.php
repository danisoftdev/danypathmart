<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid conversation.', 422);
}

$body = Response::body();
$text = isset($body['body']) ? trim((string) $body['body']) : null;
$imageUrl = isset($body['image_url']) ? trim((string) $body['image_url']) : null;
if ($text === '') {
    $text = null;
}
if ($imageUrl === '') {
    $imageUrl = null;
}

$pdo = Database::pdo();

try {
    $message = SupportChatService::sendAdminMessage($pdo, $id, (int) $user['id'], $text, $imageUrl);
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('admin support-chat reply: ' . $e->getMessage());
    Response::error('Could not send reply.', 500);
}

Response::success(['message' => $message], 201);
