<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$status = isset($_GET['status']) ? trim((string) $_GET['status']) : null;
if ($status === 'all') {
    $status = null;
}

$pdo = Database::pdo();
$conversations = SupportChatService::listForAdmin($pdo, $status);
$unread = SupportChatService::unreadAdminCount($pdo);

Response::success([
    'conversations' => $conversations,
    'unread_count'    => $unread,
]);
