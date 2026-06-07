<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$pdo = Database::pdo();
$body = Response::body();
$ids = $body['ids'] ?? null;

if (is_array($ids) && $ids !== []) {
    $ids = array_values(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0));
    if ($ids === []) {
        Response::success(['message' => 'Nothing to mark.']);
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $params = array_merge([(int) $user['id']], $ids);
    $pdo->prepare(
        "UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND id IN ({$placeholders})"
    )->execute($params);
} else {
    $pdo->prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ?')
        ->execute([(int) $user['id']]);
}

Response::success(['message' => 'Notifications marked as read.']);
