<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\ImageSearchService;
use App\Helpers\Mailer;
use App\Helpers\NotificationService;
use App\Helpers\ProductPresenter;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimiter;

// 1. Rate limit: 10 image searches per IP per hour.
$ip = RateLimiter::clientIp();
$limit = RateLimiter::hit('imgsearch:' . $ip, 10, 3600);
if (!$limit['allowed']) {
    Response::error('Too many image searches. Please try again later.', 429, [
        'code'        => 'rate_limited',
        'retry_after' => $limit['retry_after'],
    ]);
}

// 2. Validate the uploaded file.
$file = $_FILES['image'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No image uploaded.', 422, ['code' => 'no_file']);
}
if ((int) $file['size'] > 5 * 1024 * 1024) {
    Response::error('Image must be 5MB or smaller.', 422, ['code' => 'too_large']);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) {
    Response::error('Only JPEG, PNG or WebP images are allowed.', 422, ['code' => 'bad_type']);
}

// 3. Persist to /uploads/searches/{uuid}.jpg
$backendDir = dirname(__DIR__, 2);
$dir = $backendDir . '/uploads/searches';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}
$uuid = bin2hex(random_bytes(16));
$filename = $uuid . '.jpg';
$absPath = $dir . '/' . $filename;
$relPath = '/uploads/searches/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    Response::error('Could not store the uploaded image.', 500);
}

$user = AuthMiddleware::optional();
$pdo = Database::pdo();

// 5. Detect labels (Vision). Dev-only override to exercise matching locally.
$labels = ImageSearchService::detectLabels($absPath);
if (!Env::isProduction() && !empty($_POST['debug_labels'])) {
    $labels = array_values(array_filter(array_map(
        static fn ($l) => strtolower(trim((string) $l)),
        explode(',', (string) $_POST['debug_labels'])
    )));
}

// 6. Match products. JSON_TABLE (MySQL 8 / MariaDB 10.6+) is unavailable on
// MariaDB 10.4, so we score matches with JSON_SEARCH for portability.
$products = [];
if (count($labels) > 0) {
    $scoreExpr = implode(
        ' + ',
        array_fill(0, count($labels), "(JSON_SEARCH(p.tags, 'one', ?) IS NOT NULL)")
    );
    $sql = "SELECT p.id, p.category_id, p.name, p.slug, p.description, p.price, p.stock_qty,
                   p.images, p.tags, p.is_preorder, p.estimated_arrival_days, p.status, p.created_at,
                   ({$scoreExpr}) AS match_score
            FROM products p
            WHERE p.status = 'active'
            HAVING match_score > 0
            ORDER BY match_score DESC, p.created_at DESC
            LIMIT 12";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($labels);
    $products = array_map(static function (array $row): array {
        return ProductPresenter::summary($row) + ['match_score' => (int) $row['match_score']];
    }, $stmt->fetchAll());
}

// Log the search.
$logQuery = $labels ? mb_substr(implode(', ', $labels), 0, 255) : '[image search]';
$pdo->prepare(
    "INSERT INTO search_logs (user_id, query, results_count, search_type) VALUES (?, ?, ?, 'image')"
)->execute([$user['id'] ?? null, $logQuery, count($products)]);

// 4. Found products -> return them.
if (count($products) > 0) {
    Response::success([
        'found'    => true,
        'labels'   => $labels,
        'products' => $products,
    ]);
}

// 5. No products -> create alert + notify admin.
$insert = $pdo->prepare(
    "INSERT INTO image_search_alerts (user_id, image_path, labels, status) VALUES (?, ?, ?, 'pending')"
);
$insert->execute([$user['id'] ?? null, $relPath, json_encode($labels)]);
$alertId = (int) $pdo->lastInsertId();

$adminEmail = (string) Env::get('ADMIN_EMAIL', 'admin@danypathmart.store');
$appUrl = rtrim((string) Env::get('APP_URL', ''), '/');
Mailer::adminImageAlert($adminEmail, [
    'user_label' => $user ? ($user['name'] . ' (' . $user['email'] . ')') : 'Guest',
    'datetime'   => date('Y-m-d H:i:s'),
    'labels'     => $labels,
    'image_path' => $absPath,
    'link'       => $appUrl . '/admin/image-alerts/' . $alertId,
]);

NotificationService::notifyAdmins(
    $pdo,
    'Image search — no match',
    ($user ? $user['name'] . ' (' . $user['email'] . ')' : 'Guest') . ' uploaded a photo with no product match.',
    '/admin/image-alerts',
    'admin_alert'
);

Response::success([
    'found'    => false,
    'labels'   => $labels,
    'alert_id' => $alertId,
    'message'  => 'No matching products found. Our team has been notified!',
]);
