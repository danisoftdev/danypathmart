<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$fields = [
    'recipient_name' => trim((string) ($body['recipient_name'] ?? '')),
    'phone'          => trim((string) ($body['phone'] ?? '')),
    'region'         => trim((string) ($body['region'] ?? '')),
    'city'           => trim((string) ($body['city'] ?? '')),
    'street'         => trim((string) ($body['street'] ?? '')),
];
$landmark = trim((string) ($body['landmark'] ?? ''));
$isDefault = !empty($body['is_default']) ? 1 : 0;

$missing = [];
foreach ($fields as $key => $value) {
    if ($value === '') {
        $missing[] = $key;
    }
}
if ($missing !== []) {
    Response::error('Missing required address fields.', 422, ['fields' => $missing]);
}

$pdo->beginTransaction();
try {
    if ($isDefault === 1) {
        $pdo->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?')->execute([$user['id']]);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO addresses (user_id, recipient_name, phone, region, city, street, landmark, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $user['id'],
        $fields['recipient_name'],
        $fields['phone'],
        $fields['region'],
        $fields['city'],
        $fields['street'],
        $landmark !== '' ? $landmark : null,
        $isDefault,
    ]);
    $id = (int) $pdo->lastInsertId();
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

Response::success([
    'id'      => $id,
    'message' => 'Address saved.',
], 201);
