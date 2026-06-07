<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_users');

$pdo = Database::pdo();

$search = trim((string) ($_GET['search'] ?? ''));
$status = trim((string) ($_GET['status'] ?? ''));

$sql = "SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, created_at
        FROM users WHERE role = 'customer'";
$params = [];

if ($status !== '' && in_array($status, ['unverified', 'verified', 'disabled'], true)) {
    $sql .= ' AND status = ?';
    $params[] = $status;
}

if ($search !== '') {
    $sql .= ' AND (name LIKE ? OR email LIKE ? OR username LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$sql .= ' ORDER BY created_at DESC LIMIT 200';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$rows = array_map(static fn (array $r): array => [
    'id'                 => (int) $r['id'],
    'name'               => $r['name'],
    'username'           => $r['username'],
    'email'              => $r['email'],
    'phone'              => $r['phone'],
    'status'             => $r['status'],
    'preferred_currency' => $r['preferred_currency'],
    'totp_enabled'       => (int) $r['totp_enabled'] === 1,
    'created_at'         => $r['created_at'],
], $stmt->fetchAll());

Response::success(['data' => $rows]);
