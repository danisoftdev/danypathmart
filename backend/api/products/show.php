<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductPresenter;
use App\Helpers\ProductQuery;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Product slug is required', 422);
}

$pdo = Database::pdo();
[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, null);

$stmt = $pdo->prepare(
    "SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            s.name AS shop_name, s.slug AS shop_slug, s.logo_url AS shop_logo
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN shops s ON s.id = p.shop_id
     WHERE p.slug = ? AND p.status = 'active' AND {$marketSql}
     LIMIT 1"
);
$stmt->execute(array_merge([$slug], $marketParams));
$row = $stmt->fetch();

if (!$row) {
    Response::error('Product not found', 404, ['code' => 'product_not_found']);
}

$product = ProductPresenter::full($row);
$product['category'] = $row['category_name'] !== null
    ? ['id' => (int) $row['category_id'], 'name' => $row['category_name'], 'slug' => $row['category_slug']]
    : null;

$productGuideId = isset($row['size_guide_id']) && $row['size_guide_id'] !== null
    ? (int) $row['size_guide_id']
    : null;
$sizeGuide = SizeGuideService::resolveForProduct(
    $pdo,
    (int) $row['id'],
    $row['category_id'] !== null ? (int) $row['category_id'] : null,
    $productGuideId
);
if ($sizeGuide !== null) {
    $product['size_guide'] = $sizeGuide;
}

Response::success(['data' => $product]);
