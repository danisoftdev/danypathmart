<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$admin = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();

$alertId = (int) ($_GET['id'] ?? 0);
if ($alertId <= 0) {
    Response::error('Alert not found.', 404);
}

$body = Response::body();
$status = (string) ($body['status'] ?? '');
$note = isset($body['admin_note']) ? trim((string) $body['admin_note']) : null;

$allowed = ['pending', 'reviewed', 'actioned'];
if (!in_array($status, $allowed, true)) {
    Response::error('Invalid status.', 422, ['allowed' => $allowed]);
}

$check = $pdo->prepare('SELECT id FROM image_search_alerts WHERE id = ?');
$check->execute([$alertId]);
if ($check->fetchColumn() === false) {
    Response::error('Alert not found.', 404);
}

$pdo->prepare(
    'UPDATE image_search_alerts SET status = ?, admin_note = ?, reviewed_by = ? WHERE id = ?'
)->execute([$status, $note !== '' ? $note : null, (int) $admin['id'], $alertId]);

Response::success(['message' => 'Alert updated.', 'id' => $alertId, 'status' => $status]);
