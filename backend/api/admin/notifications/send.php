<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_users');

$pdo = Database::pdo();
$body = Response::body();

$title = trim((string) ($body['title'] ?? ''));
$message = trim((string) ($body['body'] ?? ''));
if ($title === '' || $message === '') {
    Response::error('Title and message are required.', 422);
}

$category = trim((string) ($body['category'] ?? 'custom'));
$allowed = ['new_arrival', 'restock', 'out_of_stock', 'system', 'custom'];
if (!in_array($category, $allowed, true)) {
    $category = 'custom';
}

$linkUrl = trim((string) ($body['link_url'] ?? ''));
if ($linkUrl !== '' && !str_starts_with($linkUrl, '/')) {
    $linkUrl = '/' . ltrim($linkUrl, '/');
}

$result = NotificationService::sendBroadcast($pdo, [
    'title'      => $title,
    'body'       => $message,
    'link_url'   => $linkUrl !== '' ? $linkUrl : null,
    'category'   => $category,
    'send_email' => !isset($body['send_email']) || !empty($body['send_email']),
], (int) $user['id']);

Response::success([
    'message'          => "Notification sent to {$result['recipient_count']} customers.",
    'recipient_count'  => $result['recipient_count'],
    'broadcast_id'     => $result['broadcast_id'],
]);
