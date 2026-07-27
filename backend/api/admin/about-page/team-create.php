<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AboutPageService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_about_page');

try {
    $member = AboutPageService::createTeamMember(Database::pdo(), Response::body());
    Response::success(['message' => 'Team member added.', 'member' => $member], 201);
} catch (InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}
