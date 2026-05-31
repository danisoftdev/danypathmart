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

$stmt = $pdo->prepare('SELECT is_default FROM addresses WHERE id = ? AND user_id = ?');
$stmt->execute([$id, (int) $user['id']]);
$row = $stmt->fetch();
if ($row === false) {
    Response::error('Address not found.', 404);
}

$pdo->prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?')->execute([$id, (int) $user['id']]);

// If we removed the default, promote the most recent remaining address.
if ((int) $row['is_default'] === 1) {
    $next = $pdo->prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
    $next->execute([(int) $user['id']]);
    $nextId = $next->fetchColumn();
    if ($nextId !== false) {
        $pdo->prepare('UPDATE addresses SET is_default = 1 WHERE id = ?')->execute([(int) $nextId]);
    }
}

Response::success(['message' => 'Address removed.']);
