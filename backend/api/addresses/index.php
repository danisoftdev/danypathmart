<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$stmt = $pdo->prepare(
    'SELECT id, recipient_name, phone, region, city, street, landmark, is_default, created_at
     FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC'
);
$stmt->execute([$user['id']]);

$rows = array_map(static function (array $r): array {
    return [
        'id'             => (int) $r['id'],
        'recipient_name' => $r['recipient_name'],
        'phone'          => $r['phone'],
        'region'         => $r['region'],
        'city'           => $r['city'],
        'street'         => $r['street'],
        'landmark'       => $r['landmark'],
        'is_default'     => (int) $r['is_default'] === 1,
    ];
}, $stmt->fetchAll());

Response::success(['data' => $rows]);
