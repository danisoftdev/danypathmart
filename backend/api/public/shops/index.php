<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopService;

$pdo = Database::pdo();
$q = trim((string) ($_GET['q'] ?? ''));
$city = trim((string) ($_GET['city'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 24)));
$offset = ($page - 1) * $perPage;

$publicShops = ShopService::listPublic($pdo);
$publicIds = array_map(static fn (array $s): int => (int) $s['id'], $publicShops);
if ($publicIds === []) {
    Response::success([
        'data' => [],
        'meta' => ['total' => 0, 'page' => $page, 'pages' => 1],
    ]);
}

$idList = implode(',', array_map('intval', $publicIds));
$where = ["s.id IN ({$idList})"];
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

$rows = [];
try {
    $sql = "SELECT s.id, s.name, s.slug, s.city, s.description, s.logo_url, s.rating_avg, s.rating_count,
                   s.latitude, s.longitude, s.contact_phone, s.customer_service_phone,
                   (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'active' AND p.listing_status = 'approved') AS product_count
            FROM shops s
            WHERE {$whereSql}
            ORDER BY s.name ASC
            LIMIT {$perPage} OFFSET {$offset}";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
} catch (\Throwable) {
    $sql = "SELECT s.id, s.name, s.slug, s.city, s.description, s.logo_url, s.rating_avg, s.rating_count,
                   s.latitude, s.longitude, s.contact_phone,
                   (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'active' AND p.listing_status = 'approved') AS product_count
            FROM shops s
            WHERE {$whereSql}
            ORDER BY s.name ASC
            LIMIT {$perPage} OFFSET {$offset}";
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
    } catch (\Throwable) {
        $sql = "SELECT s.id, s.name, s.slug, s.city, s.description, s.logo_url, s.rating_avg, s.rating_count,
                       (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'active' AND p.listing_status = 'approved') AS product_count
                FROM shops s
                WHERE {$whereSql}
                ORDER BY s.name ASC
                LIMIT {$perPage} OFFSET {$offset}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
    }
}

$data = array_map(static function (array $r): array {
    $lat = isset($r['latitude']) && $r['latitude'] !== null && $r['latitude'] !== ''
        ? (float) $r['latitude'] : null;
    $lng = isset($r['longitude']) && $r['longitude'] !== null && $r['longitude'] !== ''
        ? (float) $r['longitude'] : null;
    $hasPin = $lat !== null && $lng !== null;

    return [
        'id'                     => (int) $r['id'],
        'name'                   => $r['name'],
        'slug'                   => $r['slug'],
        'city'                   => $r['city'],
        'description'            => $r['description'],
        'logo_url'               => $r['logo_url'],
        'rating_avg'             => $r['rating_avg'] !== null ? (float) $r['rating_avg'] : null,
        'rating_count'           => (int) ($r['rating_count'] ?? 0),
        'product_count'          => (int) ($r['product_count'] ?? 0),
        'latitude'               => $hasPin ? $lat : null,
        'longitude'              => $hasPin ? $lng : null,
        'has_map_pin'            => $hasPin,
        'contact_phone'          => $r['contact_phone'] ?? null,
        'customer_service_phone' => $r['customer_service_phone'] ?? null,
    ];
}, $rows);

Response::success([
    'data' => $data,
    'meta' => ['total' => $total, 'page' => $page, 'pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 1],
]);
