<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
if (($user['role'] ?? '') !== 'customer') {
    Response::error('Wishlist is for customer accounts.', 403);
}

$pdo = Database::pdo();
$userId = (int) $user['id'];

$stmt = $pdo->prepare(
    'SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM wishlists w
     INNER JOIN products p ON p.id = w.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE w.user_id = ? AND p.status = \'active\'
     ORDER BY w.created_at DESC'
);
$stmt->execute([$userId]);

$data = array_map(
    static fn (array $row): array => ProductPresenter::summary($row),
    $stmt->fetchAll()
);

$ids = array_map(static fn (array $p): int => (int) $p['id'], $data);

Response::success(['data' => $data, 'ids' => $ids]);
