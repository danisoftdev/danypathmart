<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();

$stmt = $pdo->prepare(
    'SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.shop_id = ? ORDER BY p.created_at DESC'
);
$stmt->execute([$ctx['shop_id']]);

Response::success([
    'data' => array_map(static function (array $r): array {
        $row = ProductPresenter::summary($r) + [
            'listing_status' => $r['listing_status'] ?? 'none',
            'status'         => $r['status'],
        ];
        if (array_key_exists('listing_admin_note', $r)) {
            $row['listing_admin_note'] = $r['listing_admin_note'];
        }
        return $row;
    }, $stmt->fetchAll()),
]);
