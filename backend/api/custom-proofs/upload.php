<?php

declare(strict_types=1);

use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$file = $_FILES['file'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No file uploaded.', 422, ['code' => 'no_file']);
}
if ((int) $file['size'] > 5 * 1024 * 1024) {
    Response::error('File must be 5MB or smaller.', 422, ['code' => 'too_large']);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) {
    Response::error('Upload JPEG, PNG, WebP, or PDF only.', 422, ['code' => 'bad_type']);
}

$backendDir = dirname(__DIR__, 2);
$dir = $backendDir . '/uploads/customizations';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

$filename = (int) $user['id'] . '_' . bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
$absPath = $dir . '/' . $filename;
$relPath = '/uploads/customizations/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    Response::error('Could not store the uploaded file.', 500);
}

Response::success([
    'message'   => 'Proof uploaded.',
    'file_path' => $relPath,
]);
