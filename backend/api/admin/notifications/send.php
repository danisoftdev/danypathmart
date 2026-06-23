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
    'title'          => $title,
    'body'           => $message,
    'link_url'       => $linkUrl !== '' ? $linkUrl : null,
    'category'       => $category,
    'send_email'     => !isset($body['send_email']) || !empty($body['send_email']),
    'send_sms'       => !empty($body['send_sms']),
    'send_whatsapp'  => !empty($body['send_whatsapp']),
], (int) $user['id']);

$extra = '';
if (!empty($body['send_sms']) || !empty($body['send_whatsapp'])) {
    PermissionMiddleware::require('manage_messaging_integrations');
    $parts = [];
    if (!empty($body['send_sms'])) {
        $parts[] = "{$result['sms_sent']} SMS";
    }
    if (!empty($body['send_whatsapp'])) {
        $parts[] = "{$result['whatsapp_sent']} WhatsApp";
    }
    if ($parts !== []) {
        $extra = ' (' . implode(', ', $parts) . ' sent)';
    }
}

Response::success([
    'message'          => "Notification sent to {$result['recipient_count']} customers{$extra}.",
    'recipient_count'  => $result['recipient_count'],
    'sms_sent'         => $result['sms_sent'],
    'whatsapp_sent'    => $result['whatsapp_sent'],
    'broadcast_id'     => $result['broadcast_id'],
]);
