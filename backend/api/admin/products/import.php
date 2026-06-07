<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('add_edit_products');

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    Response::error('Upload a CSV file.', 422);
}

$tmp = $_FILES['file']['tmp_name'];
$handle = fopen($tmp, 'r');
if ($handle === false) {
    Response::error('Could not read uploaded file.', 422);
}

$pdo = Database::pdo();
$firstLine = fgets($handle);
if ($firstLine === false) {
    fclose($handle);
    Response::error('CSV file is empty.', 422);
}

$firstLine = preg_replace('/^\xEF\xBB\xBF/', '', $firstLine) ?? $firstLine;
$headers = str_getcsv($firstLine);
$headers = array_map(static fn ($h) => strtolower(trim((string) $h)), $headers);

if (!in_array('slug', $headers, true)) {
    fclose($handle);
    Response::error('CSV must include a slug column. Download the import template first.', 422);
}

$categoryMap = [];
foreach ($pdo->query('SELECT id, name FROM categories') as $cat) {
    $categoryMap[strtolower(trim((string) $cat['name']))] = (int) $cat['id'];
}

$findBySlug = $pdo->prepare('SELECT id FROM products WHERE slug = ? LIMIT 1');
$update = $pdo->prepare(
    'UPDATE products SET
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        cost_price = COALESCE(?, cost_price),
        compare_at_price = ?,
        stock_qty = COALESCE(?, stock_qty),
        status = COALESCE(?, status),
        category_id = ?,
        tags = ?,
        is_preorder = COALESCE(?, is_preorder),
        badge_label = ?
     WHERE id = ?'
);
$insert = $pdo->prepare(
    'INSERT INTO products (name, slug, price, cost_price, compare_at_price, stock_qty, status,
                           category_id, tags, is_preorder, badge_label, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$updated = 0;
$created = 0;
$skipped = 0;
$errors = [];
$rowNum = 1;

while (($data = fgetcsv($handle)) !== false) {
    $rowNum++;
    if ($data === [null] || $data === [] || trim(implode('', $data)) === '') {
        continue;
    }

    $row = [];
    foreach ($headers as $i => $key) {
        $row[$key] = isset($data[$i]) ? trim((string) $data[$i]) : '';
    }

    $slug = $row['slug'] ?? '';
    if ($slug === '') {
        $skipped++;
        continue;
    }

    $name = $row['name'] ?? '';
    $priceRaw = $row['price'] ?? '';
    $price = $priceRaw !== '' ? (float) $priceRaw : null;
    $costRaw = $row['cost_price'] ?? '';
    $cost = $costRaw !== '' ? max(0, (float) $costRaw) : null;
    $stockRaw = $row['stock_qty'] ?? '';
    $stock = $stockRaw !== '' ? max(0, (int) $stockRaw) : null;
    $status = $row['status'] ?? '';
    if ($status !== '' && !in_array($status, ['active', 'inactive', 'draft'], true)) {
        $errors[] = "Row {$rowNum}: invalid status \"{$status}\".";
        $skipped++;
        continue;
    }
    $status = $status !== '' ? $status : null;

    $compareRaw = $row['compare_at_price'] ?? '';
    $compareAt = $compareRaw !== '' ? (float) $compareRaw : null;

    $categoryId = null;
    $catName = strtolower($row['category'] ?? '');
    if ($catName !== '' && isset($categoryMap[$catName])) {
        $categoryId = $categoryMap[$catName];
    }

    $tagsRaw = $row['tags'] ?? '';
    $tags = $tagsRaw !== ''
        ? array_values(array_filter(array_map('trim', preg_split('/[;,]/', $tagsRaw) ?: [])))
        : null;
    $tagsJson = $tags !== null ? json_encode($tags, JSON_UNESCAPED_UNICODE) : null;

    $preorderRaw = strtolower($row['is_preorder'] ?? '');
    $isPreorder = in_array($preorderRaw, ['1', 'yes', 'true'], true) ? 1
        : (in_array($preorderRaw, ['0', 'no', 'false'], true) ? 0 : null);

    $badge = ($row['badge_label'] ?? '') !== '' ? $row['badge_label'] : null;

    $findBySlug->execute([$slug]);
    $existing = $findBySlug->fetch();

    try {
        if ($existing !== false) {
            $update->execute([
                $name !== '' ? $name : null,
                $price,
                $cost,
                $compareAt,
                $stock,
                $status,
                $categoryId,
                $tagsJson,
                $isPreorder,
                $badge,
                (int) $existing['id'],
            ]);
            $updated++;
        } else {
            if ($name === '' || $price === null) {
                $errors[] = "Row {$rowNum}: new product \"{$slug}\" needs name and price.";
                $skipped++;
                continue;
            }
            $insert->execute([
                $name,
                $slug,
                $price,
                $cost ?? 0,
                $compareAt,
                $stock ?? 0,
                $status ?? 'draft',
                $categoryId,
                $tagsJson ?? '[]',
                $isPreorder ?? 0,
                $badge,
                '[]',
            ]);
            $created++;
        }
    } catch (\Throwable $e) {
        $errors[] = "Row {$rowNum}: " . $e->getMessage();
        $skipped++;
    }
}

fclose($handle);

Response::success([
    'message' => "Import complete: {$created} created, {$updated} updated, {$skipped} skipped.",
    'created' => $created,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors'  => array_slice($errors, 0, 20),
]);
