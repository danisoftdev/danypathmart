<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'approve_shop_listings', 'add_edit_products']);

$pdo = Database::pdo();
$listing = trim((string) ($_GET['listing'] ?? 'pending'));

$sql = "SELECT p.id, p.name, p.slug, p.price, p.stock_qty, p.status, p.listing_status, p.created_at,
               p.shop_badge_label, p.shop_promo_free_delivery, p.shop_badge_hidden,
               s.name AS shop_name, s.slug AS shop_slug
        FROM products p
        INNER JOIN shops s ON s.id = p.shop_id
        WHERE p.shop_id IS NOT NULL";
$params = [];
if ($listing !== 'all') {
    $sql .= ' AND p.listing_status = ?';
    $params[] = $listing;
}
$sql .= ' ORDER BY p.created_at DESC LIMIT 200';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

Response::success(['data' => $stmt->fetchAll()]);
