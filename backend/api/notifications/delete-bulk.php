<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$pdo = Database::pdo();
$body = Response::body();
$ids = $body['ids'] ?? [];

if (!is_array($ids)) {
    Response::error('Select at least one notification to delete.', 422);
}

$ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
if ($ids === []) {
    Response::error('Select at least one notification to delete.', 422);
}

$deleted = NotificationService::deleteForUser($pdo, (int) $user['id'], $ids);

Response::success([
    'message' => 'Deleted ' . $deleted . ' notification(s).',
    'deleted' => $deleted,
]);
