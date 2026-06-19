<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$pdo = Database::pdo();
$unread = SupportChatService::unreadAdminCount($pdo);

Response::success(['unread_count' => $unread]);
