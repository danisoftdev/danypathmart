<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_about_page');

$file = $_FILES['image'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No image uploaded.', 422);
}
if ((int) $file['size'] > 5 * 1024 * 1024) {
    Response::error('Team photo must be 5MB or smaller.', 422);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) {
    Response::error('Only JPEG, PNG or WebP images are allowed.', 422);
}

$dir = dirname(__DIR__, 3) . '/uploads/about';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

$filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
    Response::error('Could not store the uploaded image.', 500);
}

Response::success([
    'message' => 'Image uploaded.',
    'url'     => '/uploads/about/' . $filename,
]);
