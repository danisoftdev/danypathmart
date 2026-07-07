<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\TrustAutomationService;
use App\Helpers\UserCautionService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$admin = AuthMiddleware::authenticate();
PermissionMiddleware::require('issue_user_caution');
$pdo = Database::pdo();
$body = Response::body();

$userId = (int) ($body['user_id'] ?? 0);
$level = trim((string) ($body['level'] ?? 'caution'));
$message = trim((string) ($body['message'] ?? ''));
$internalNote = isset($body['internal_note']) ? trim((string) $body['internal_note']) : null;
$reportId = isset($body['report_id']) ? (int) $body['report_id'] : null;

if ($userId <= 0) {
    Response::error('User id required.', 422);
}

if ($level === 'restriction' || $level === 'suspension') {
    PermissionMiddleware::require('restrict_users');
}

try {
    $caution = UserCautionService::issue(
        $pdo,
        $userId,
        (int) $admin['id'],
        $level,
        $message,
        $internalNote,
        $reportId,
        null
    );
} catch (RuntimeException $e) {
    Response::error($e->getMessage(), 422);
}

Response::success(['caution' => $caution], 201);
