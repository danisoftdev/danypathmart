<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LegalPolicyService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_legal_policies');

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Policy not found.', 404);
}

try {
    $policy = LegalPolicyService::update(Database::pdo(), $id, Response::body());
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['message' => 'Policy updated.', 'policy' => $policy]);
