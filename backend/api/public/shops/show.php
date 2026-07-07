<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PlatformFeatures;
use App\Helpers\ProductPresenter;
use App\Helpers\ProductQuery;
use App\Helpers\Response;
use App\Helpers\ShopService;
use App\Helpers\StorefrontOrderService;

$pdo = Database::pdo();
if (!PlatformFeatures::load($pdo)['marketplace_enabled']) {
    Response::error('Marketplace is not available.', 404);
}

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Shop not found.', 404);
}

$shop = ShopService::findBySlug($pdo, $slug);
if ($shop === null) {
    Response::error('Shop not found.', 404);
}

[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, (int) $shop['id']);
$sql = "SELECT p.*, c.name AS category_name, c.slug AS category_slug,
               s.name AS shop_name, s.slug AS shop_slug, s.logo_url AS shop_logo
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN shops s ON s.id = p.shop_id
        WHERE {$marketSql}
        ORDER BY p.created_at DESC LIMIT 48";
$stmt = $pdo->prepare($sql);
$stmt->execute($marketParams);
$products = array_map(
    static fn (array $row): array => ProductPresenter::summary($row),
    $stmt->fetchAll()
);

$publicShop = $shop;
unset(
    $publicShop['paystack_subaccount_code'],
    $publicShop['bank_name'],
    $publicShop['bank_account_name'],
    $publicShop['bank_account_number']
);

Response::success([
    'shop'             => $publicShop,
    'products'         => $products,
    'payment_methods'  => StorefrontOrderService::paymentMethodsForShop($pdo, $shop),
    'store_url'        => '/stores/' . $slug,
]);
