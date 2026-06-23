<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\MessagingIntegrationService;
use App\Helpers\NotificationChannelService;
use App\Helpers\PushNotificationService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('manage_messaging_integrations');

$body = Response::body();
$pdo = Database::pdo();

$userId = (int) ($body['user_id'] ?? 0);
$phone = trim((string) ($body['phone'] ?? ''));
$title = trim((string) ($body['title'] ?? ''));
$message = trim((string) ($body['body'] ?? $body['message'] ?? ''));

if ($title === '' || $message === '') {
    Response::error('Title and message are required.', 422);
}

$sendPush = !isset($body['send_push']) || !empty($body['send_push']);
$sendSms = !empty($body['send_sms']);
$sendWhatsapp = !empty($body['send_whatsapp']);

if ($userId <= 0 && $phone === '') {
    Response::error('Provide user_id or phone.', 422);
}

$result = ['push' => null, 'sms' => null, 'whatsapp' => null];

if ($userId > 0) {
    if ($sendPush) {
        PushNotificationService::notifyUser($pdo, $userId, $title, $message, null);
        $result['push'] = ['ok' => true];
    }
    $ext = NotificationChannelService::sendExternalToUser(
        $pdo,
        $userId,
        $title,
        $message,
        $sendSms,
        $sendWhatsapp
    );
    $result['sms'] = $ext['sms'];
    $result['whatsapp'] = $ext['whatsapp'];
    $result['phone'] = $ext['phone'];
} else {
    if ($sendSms) {
        $result['sms'] = MessagingIntegrationService::sendSms($pdo, $phone, $message, $title);
    }
    if ($sendWhatsapp) {
        $result['whatsapp'] = MessagingIntegrationService::sendWhatsApp($pdo, $phone, $message, $title);
    }
    $result['phone'] = $phone;
}

Response::success([
    'message' => 'Manual notification dispatched.',
    'result'  => $result,
    'settings' => MessagingIntegrationService::load($pdo),
]);
