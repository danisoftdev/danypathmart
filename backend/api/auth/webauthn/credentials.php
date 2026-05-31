<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$stmt = $pdo->prepare(
    'SELECT id, device_name, sign_count, created_at FROM user_credentials WHERE user_id = ? ORDER BY created_at DESC'
);
$stmt->execute([(int) $user['id']]);

$creds = array_map(static fn (array $c): array => [
    'id'          => (int) $c['id'],
    'device_name' => $c['device_name'] ?: 'Security key',
    'created_at'  => $c['created_at'],
], $stmt->fetchAll());

Response::success(['data' => $creds]);
