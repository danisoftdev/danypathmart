<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$file = $_FILES['avatar'] ?? null;
if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    Response::error('No image uploaded.', 422, ['code' => 'no_file']);
}
if ((int) $file['size'] > 3 * 1024 * 1024) {
    Response::error('Avatar must be 3MB or smaller.', 422, ['code' => 'too_large']);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($file['tmp_name']);
if (!isset($allowed[$mime])) {
    Response::error('Only JPEG, PNG or WebP images are allowed.', 422, ['code' => 'bad_type']);
}

$backendDir = dirname(__DIR__, 2);
$dir = $backendDir . '/uploads/avatars';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}
$filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
$absPath = $dir . '/' . $filename;
$relPath = '/uploads/avatars/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    Response::error('Could not store the uploaded image.', 500);
}

// Remove the previous avatar file if it lived in our uploads dir.
$old = $pdo->prepare('SELECT profile_photo FROM users WHERE id = ?');
$old->execute([(int) $user['id']]);
$prev = (string) ($old->fetchColumn() ?: '');
if ($prev !== '' && str_starts_with($prev, '/uploads/avatars/')) {
    @unlink($backendDir . $prev);
}

$pdo->prepare('UPDATE users SET profile_photo = ? WHERE id = ?')->execute([$relPath, (int) $user['id']]);

$stmt = $pdo->prepare(
    'SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
     FROM users WHERE id = ?'
);
$stmt->execute([(int) $user['id']]);

Response::success([
    'message'       => 'Avatar updated.',
    'profile_photo' => $relPath,
    'user'          => AuthTokens::publicUser($stmt->fetch()),
]);
