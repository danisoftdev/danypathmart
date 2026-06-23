<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportBotService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_support_bot', 'manage_contact_inbox']);

Response::success(['data' => SupportBotService::listNodes(Database::pdo(), false)]);
