<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Middleware\ShopMiddleware;

ShopMiddleware::requireShopMember();

$file = $_FILES['image'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No image uploaded.', 422, ['code' => 'no_file']);
}
if ((int) $file['size'] > 5 * 1024 * 1024) {
    Response::error('Shop logo must be 5MB or smaller.', 422, ['code' => 'too_large']);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) {
    Response::error('Only JPEG, PNG or WebP images are allowed.', 422, ['code' => 'bad_type']);
}

$backendDir = dirname(__DIR__, 2);
$dir = $backendDir . '/uploads/shops';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

$filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
$absPath = $dir . '/' . $filename;
$relPath = '/uploads/shops/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    Response::error('Could not store the uploaded image.', 500);
}

Response::success([
    'message' => 'Logo uploaded.',
    'url'     => $relPath,
]);
