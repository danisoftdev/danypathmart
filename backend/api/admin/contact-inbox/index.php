<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$pdo = Database::pdo();
$unreadOnly = isset($_GET['unread']) && (string) $_GET['unread'] === '1';

$sql = 'SELECT id, user_id, name, email, subject, message, is_read, created_at
        FROM contact_messages';
if ($unreadOnly) {
    $sql .= ' WHERE is_read = 0';
}
$sql .= ' ORDER BY created_at DESC LIMIT 200';

$rows = $pdo->query($sql)->fetchAll();

$unread = (int) $pdo->query('SELECT COUNT(*) FROM contact_messages WHERE is_read = 0')->fetchColumn();

$data = array_map(static fn (array $r): array => [
    'id'         => (int) $r['id'],
    'user_id'    => $r['user_id'] !== null ? (int) $r['user_id'] : null,
    'name'       => $r['name'],
    'email'      => $r['email'],
    'subject'    => $r['subject'],
    'message'    => $r['message'],
    'is_read'    => (bool) $r['is_read'],
    'created_at' => $r['created_at'],
], $rows);

Response::success(['data' => $data, 'unread_count' => $unread]);
