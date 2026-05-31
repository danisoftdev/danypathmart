<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid address.', 422);
}

$own = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
$own->execute([$id, (int) $user['id']]);
if ($own->fetchColumn() === false) {
    Response::error('Address not found.', 404);
}

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?')->execute([(int) $user['id']]);
    $pdo->prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?')
        ->execute([$id, (int) $user['id']]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

Response::success(['message' => 'Default address updated.']);
