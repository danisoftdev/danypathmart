<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$pdo = Database::pdo();

$priceRow = $pdo->query(
    "SELECT COALESCE(MIN(price), 0) AS price_min, COALESCE(MAX(price), 0) AS price_max
     FROM products WHERE status = 'active'"
)->fetch();

$origins = $pdo->query(
    "SELECT DISTINCT origin_country FROM products
     WHERE status = 'active' AND origin_country IS NOT NULL AND origin_country != ''
     ORDER BY origin_country ASC"
)->fetchAll(PDO::FETCH_COLUMN);

$tagRows = $pdo->query("SELECT tags FROM products WHERE status = 'active' AND tags IS NOT NULL")->fetchAll();
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
