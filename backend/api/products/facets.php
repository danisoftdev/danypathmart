<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ProductQuery;
use App\Helpers\Response;

$pdo = Database::pdo();
[$marketSql, $marketParams] = ProductQuery::marketplaceVisibility($pdo, null);

$priceStmt = $pdo->prepare(
    "SELECT COALESCE(MIN(p.price), 0) AS price_min, COALESCE(MAX(p.price), 0) AS price_max
     FROM products p
     WHERE p.status = 'active' AND {$marketSql}"
);
$priceStmt->execute($marketParams);
$priceRow = $priceStmt->fetch();

$originStmt = $pdo->prepare(
    "SELECT DISTINCT p.origin_country FROM products p
     WHERE p.status = 'active' AND p.origin_country IS NOT NULL AND p.origin_country != ''
       AND {$marketSql}
     ORDER BY p.origin_country ASC"
);
$originStmt->execute($marketParams);
$origins = $originStmt->fetchAll(PDO::FETCH_COLUMN);

$tagStmt = $pdo->prepare(
    "SELECT p.tags FROM products p
     WHERE p.status = 'active' AND p.tags IS NOT NULL AND {$marketSql}"
);
$tagStmt->execute($marketParams);
$tagRows = $tagStmt->fetchAll();
$tagSet = [];
foreach ($tagRows as $row) {
    $decoded = json_decode((string) ($row['tags'] ?? '[]'), true);
    if (!is_array($decoded)) {
        continue;
    }
    foreach ($decoded as $tag) {
        $t = trim((string) $tag);
        if ($t !== '') {
            $tagSet[strtolower($t)] = $t;
        }
    }
}
$tags = array_values($tagSet);
sort($tags, SORT_NATURAL | SORT_FLAG_CASE);

Response::success([
    'facets' => [
        'price_min' => round((float) ($priceRow['price_min'] ?? 0), 2),
        'price_max' => round((float) ($priceRow['price_max'] ?? 0), 2),
        'origin_countries' => array_values(array_map('strval', $origins)),
        'tags' => $tags,
    ],
]);
