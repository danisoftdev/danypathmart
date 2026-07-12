<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AccountDeletionService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    Response::success([
        'retention_days' => AccountDeletionService::RETENTION_DAYS,
        'reasons'        => AccountDeletionService::REASONS,
    ]);
}

if ($method !== 'POST') {
    Response::error('Method not allowed', 405);
}

$body = Response::body();
$reason = trim((string) ($body['reason'] ?? ''));
$detail = isset($body['detail']) ? trim((string) $body['detail']) : null;

$result = AccountDeletionService::request($pdo, (int) $user['id'], $reason, $detail);
if (!$result['ok']) {
    Response::error($result['message'], 422);
}

Response::success([
    'message'        => $result['message'],
    'retention_days' => AccountDeletionService::RETENTION_DAYS,
]);
