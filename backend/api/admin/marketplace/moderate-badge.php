<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'approve_shop_listings', 'add_edit_products']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Product not found.', 404);
}

$pdo = Database::pdo();
$body = Response::body();
$action = trim((string) ($body['action'] ?? ''));

$stmt = $pdo->prepare('SELECT id, shop_id FROM products WHERE id = ? AND shop_id IS NOT NULL');
$stmt->execute([$id]);
if ($stmt->fetch() === false) {
    Response::error('Marketplace listing not found.', 404);
}

match ($action) {
    'hide' => $pdo->prepare('UPDATE products SET shop_badge_hidden = 1 WHERE id = ?')->execute([$id]),
    'unhide' => $pdo->prepare('UPDATE products SET shop_badge_hidden = 0 WHERE id = ?')->execute([$id]),
    'clear' => $pdo->prepare(
        'UPDATE products SET shop_badge_label = NULL, shop_promo_free_delivery = 0, shop_badge_hidden = 0 WHERE id = ?'
    )->execute([$id]),
    default => Response::error('Invalid action. Use hide, unhide, or clear.', 422),
};

Response::success(['message' => 'Listing badges updated.', 'id' => $id, 'action' => $action]);
