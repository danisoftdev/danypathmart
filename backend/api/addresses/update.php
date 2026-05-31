<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid address.', 422);
}

$own = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
$own->execute([$id, (int) $user['id']]);
if ($own->fetchColumn() === false) {
    Response::error('Address not found.', 404);
}

$fields = [
    'recipient_name' => trim((string) ($body['recipient_name'] ?? '')),
    'phone'          => trim((string) ($body['phone'] ?? '')),
    'region'         => trim((string) ($body['region'] ?? '')),
    'city'           => trim((string) ($body['city'] ?? '')),
    'street'         => trim((string) ($body['street'] ?? '')),
];
$landmark = trim((string) ($body['landmark'] ?? ''));
$isDefault = !empty($body['is_default']) ? 1 : 0;

$missing = array_keys(array_filter($fields, static fn ($v) => $v === ''));
if ($missing !== []) {
    Response::error('Missing required address fields.', 422, ['fields' => $missing]);
}

$pdo->beginTransaction();
try {
    if ($isDefault === 1) {
        $pdo->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?')->execute([(int) $user['id']]);
    }
    $pdo->prepare(
        'UPDATE addresses
            SET recipient_name = ?, phone = ?, region = ?, city = ?, street = ?, landmark = ?, is_default = ?
          WHERE id = ? AND user_id = ?'
    )->execute([
        $fields['recipient_name'],
        $fields['phone'],
        $fields['region'],
        $fields['city'],
        $fields['street'],
        $landmark !== '' ? $landmark : null,
        $isDefault,
        $id,
        (int) $user['id'],
    ]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

Response::success(['id' => $id, 'message' => 'Address updated.']);
