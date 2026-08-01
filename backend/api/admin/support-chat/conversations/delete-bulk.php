<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_contact_inbox', 'view_company_settings']);

$body = Response::body();
$ids = $body['ids'] ?? [];
if (!is_array($ids)) {
    Response::error('Select at least one chat to delete.', 422);
}

$pdo = Database::pdo();
$deleted = SupportChatService::deleteManyForAdmin($pdo, $ids);
if ($deleted === 0) {
    Response::error('No chats deleted.', 404);
}

Response::success([
    'message' => 'Deleted ' . $deleted . ' chat(s).',
    'deleted' => $deleted,
]);
