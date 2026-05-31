<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid credential.', 422);
}

$stmt = $pdo->prepare('SELECT id FROM user_credentials WHERE id = ? AND user_id = ?');
$stmt->execute([$id, (int) $user['id']]);
if ($stmt->fetchColumn() === false) {
    Response::error('Credential not found.', 404);
}

$pdo->prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?')
    ->execute([$id, (int) $user['id']]);

Response::success(['message' => 'Passkey removed.']);
