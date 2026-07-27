<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AboutPageService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_about_page');

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid team member.', 422);
}

try {
    AboutPageService::deleteTeamMember(Database::pdo(), $id);
    Response::success(['message' => 'Team member removed.']);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}
