<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid conversation.', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare('SELECT * FROM support_conversations WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Conversation not found.', 404);
}

SupportChatService::markAdminRead($pdo, $id);

$messages = SupportChatService::listMessages($pdo, $id);

Response::success([
    'conversation' => [
        'id'                      => (int) $row['id'],
        'user_id'                 => $row['user_id'] !== null ? (int) $row['user_id'] : null,
        'guest_name'              => $row['guest_name'],
        'guest_email'             => $row['guest_email'],
        'status'                  => $row['status'],
        'admin_unread_count'      => 0,
        'customer_unread_count'   => (int) ($row['customer_unread_count'] ?? 0),
        'last_message_at'         => $row['last_message_at'],
        'created_at'              => $row['created_at'],
    ],
    'messages' => $messages,
]);
