<?php



declare(strict_types=1);



use App\Config\Database;

use App\Helpers\ProductPresenter;

use App\Helpers\Response;

use App\Middleware\AuthMiddleware;

use App\Middleware\PermissionMiddleware;



AuthMiddleware::requireAdmin();

PermissionMiddleware::require('view_products');



$pdo = Database::pdo();



$search = trim((string) ($_GET['search'] ?? ''));

$status = trim((string) ($_GET['status'] ?? ''));

$categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== ''

    ? (int) $_GET['category_id']

    : 0;



$sql = 'SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price, p.cost_price, p.compare_at_price,
               p.rating_avg, p.rating_count, p.badge_label, p.is_featured, p.is_flash_deal, p.stock_qty,
               p.images, p.tags, p.is_preorder, p.origin_country, p.estimated_arrival_days, p.status, p.created_at,
               c.name AS category_name, c.slug AS category_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE 1=1';

$params = [];



if ($status !== '' && in_array($status, ['active', 'inactive', 'draft'], true)) {

    $sql .= ' AND p.status = ?';

    $params[] = $status;

}



if ($categoryId > 0) {

    $sql .= ' AND p.category_id = ?';

    $params[] = $categoryId;

}

$flashDeal = trim((string) ($_GET['is_flash_deal'] ?? ''));
if ($flashDeal !== '' && in_array($flashDeal, ['0', '1'], true)) {
    $sql .= ' AND p.is_flash_deal = ?';
    $params[] = (int) $flashDeal;
}

if ($search !== '') {

    $sql .= ' AND (p.name LIKE ? OR p.slug LIKE ?)';

    $like = '%' . $search . '%';

    $params[] = $like;

    $params[] = $like;

}



$sql .= ' ORDER BY p.created_at DESC LIMIT 200';



$stmt = $pdo->prepare($sql);

$stmt->execute($params);



$data = array_map(

    static fn (array $row): array => ProductPresenter::summary($row) + [

        'status'                 => $row['status'],

        'description'            => $row['description'],

        'origin_country'         => $row['origin_country'],

        'estimated_arrival_days' => $row['estimated_arrival_days'] !== null ? (int) $row['estimated_arrival_days'] : null,

    ],

    $stmt->fetchAll()

);



Response::success(['data' => $data]);

