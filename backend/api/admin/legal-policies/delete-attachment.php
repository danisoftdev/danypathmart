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

$pdo = Database::pdo();

try {
    $policy = LegalPolicyService::clearAttachment($pdo, $id);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 404);
} catch (\Throwable $e) {
    Response::error($e->getMessage(), 500);
}

Response::success([
    'message' => 'Download file removed.',
    'policy'  => $policy,
]);
