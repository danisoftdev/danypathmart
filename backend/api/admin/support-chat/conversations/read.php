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
SupportChatService::markAdminRead($pdo, $id);

Response::success(['message' => 'Marked as read.']);
