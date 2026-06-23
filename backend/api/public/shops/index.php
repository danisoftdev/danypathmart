<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$pdo = Database::pdo();
$q = trim((string) ($_GET['q'] ?? ''));
$city = trim((string) ($_GET['city'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 24)));
$offset = ($page - 1) * $perPage;

$where = ["s.status = 'active'"];
$params = [];

if ($q !== '') {
    $where[] = '(s.name LIKE ? OR s.description LIKE ? OR s.city LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
if ($city !== '') {
    $where[] = 's.city = ?';
    $params[] = $city;
}

$whereSql = implode(' AND ', $where);

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM shops s WHERE {$whereSql}");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$sql = "SELECT s.id, s.name, s.slug, s.city, s.description, s.logo_url, s.rating_avg, s.rating_count,
               (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'active' AND p.listing_status = 'approved') AS product_count
        FROM shops s
        WHERE {$whereSql}
        ORDER BY s.name ASC
        LIMIT {$perPage} OFFSET {$offset}";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$data = array_map(static fn (array $r): array => [
    'id'            => (int) $r['id'],
    'name'          => $r['name'],
    'slug'          => $r['slug'],
    'city'          => $r['city'],
    'description'   => $r['description'],
    'logo_url'      => $r['logo_url'],
    'rating_avg'    => $r['rating_avg'] !== null ? (float) $r['rating_avg'] : null,
    'rating_count'  => (int) ($r['rating_count'] ?? 0),
    'product_count' => (int) ($r['product_count'] ?? 0),
], $stmt->fetchAll());

Response::success([
    'data' => $data,
    'meta' => ['total' => $total, 'page' => $page, 'pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 1],
]);
