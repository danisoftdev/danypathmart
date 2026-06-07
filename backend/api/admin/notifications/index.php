<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_users');

$pdo = Database::pdo();
$rows = $pdo->query(
    'SELECT b.id, b.title, b.body, b.link_url, b.category, b.send_email, b.recipient_count,
            b.created_at, u.name AS sent_by_name
     FROM admin_broadcasts b
     LEFT JOIN users u ON u.id = b.sent_by
     ORDER BY b.created_at DESC
     LIMIT 50'
)->fetchAll();

$data = array_map(static fn (array $r): array => [
    'id'               => (int) $r['id'],
    'title'            => $r['title'],
    'body'             => $r['body'],
    'link_url'         => $r['link_url'],
    'category'         => $r['category'],
    'send_email'       => (bool) $r['send_email'],
    'recipient_count'  => (int) $r['recipient_count'],
    'sent_by_name'     => $r['sent_by_name'],
    'created_at'       => $r['created_at'],
], $rows);

Response::success(['data' => $data]);
