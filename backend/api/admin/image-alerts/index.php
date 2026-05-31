<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAdmin();
$pdo = Database::pdo();

$status = isset($_GET['status']) ? (string) $_GET['status'] : '';
$allowed = ['pending', 'reviewed', 'actioned'];

$where = '';
$params = [];
if (in_array($status, $allowed, true)) {
    $where = 'WHERE a.status = ?';
    $params[] = $status;
}

$stmt = $pdo->prepare(
    "SELECT a.id, a.user_id, a.image_path, a.search_query, a.labels, a.status,
            a.admin_note, a.reviewed_by, a.created_at,
            u.name AS user_name, u.email AS user_email,
            r.name AS reviewer_name
     FROM image_search_alerts a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN users r ON r.id = a.reviewed_by
     {$where}
     ORDER BY a.created_at DESC
     LIMIT 200"
);
$stmt->execute($params);

$rows = array_map(static function (array $r): array {
    $labels = json_decode((string) ($r['labels'] ?? ''), true);
    return [
        'id'            => (int) $r['id'],
        'image_path'    => $r['image_path'],
        'search_query'  => $r['search_query'],
        'labels'        => is_array($labels) ? $labels : [],
        'status'        => $r['status'],
        'admin_note'    => $r['admin_note'],
        'reviewer_name' => $r['reviewer_name'],
        'created_at'    => $r['created_at'],
        'user'          => $r['user_id'] !== null
            ? ['name' => $r['user_name'], 'email' => $r['user_email']]
            : null,
    ];
}, $stmt->fetchAll());

$pending = (int) $pdo->query(
    "SELECT COUNT(*) FROM image_search_alerts WHERE status = 'pending'"
)->fetchColumn();

Response::success([
    'data'          => $rows,
    'pending_count' => $pending,
]);
