<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Mailer;
use App\Helpers\NotificationService;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$body = Response::body();
$user = AuthMiddleware::optional();

$name = trim((string) ($body['name'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$subject = trim((string) ($body['subject'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));

if ($name === '') {
    Response::error('Please enter your name.', 422);
}
if ($email === '' || !Validator::email($email)) {
    Response::error('Please enter a valid email address.', 422);
}
if ($message === '') {
    Response::error('Please enter your message.', 422);
}
if (strlen($message) > 5000) {
    Response::error('Message is too long (max 5000 characters).', 422);
}

$userId = null;
if ($user !== null && ($user['role'] ?? '') === 'customer') {
    $userId = (int) $user['id'];
    if ($name === '') {
        $name = (string) ($user['name'] ?? $name);
    }
    if ($email === '') {
        $email = (string) ($user['email'] ?? $email);
    }
}

$pdo->prepare(
    'INSERT INTO contact_messages (user_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)'
)->execute([
    $userId,
    $name,
    $email,
    $subject !== '' ? $subject : null,
    $message,
]);

$messageId = (int) $pdo->lastInsertId();

Env::load();
$adminEmail = (string) Env::get('ADMIN_EMAIL', 'admin@danypathmart.store');
Mailer::contactFormToAdmin($adminEmail, [
    'id'      => $messageId,
    'name'    => $name,
    'email'   => $email,
    'subject' => $subject !== '' ? $subject : 'Contact form message',
    'message' => $message,
]);

NotificationService::notifyAdmins(
    $pdo,
    'Contact message — ' . ($subject !== '' ? $subject : 'New inquiry'),
    "{$name} ({$email}):\n\n{$message}",
    '/admin/contact-inbox',
    'admin_contact'
);

Response::success([
    'message' => 'Thank you — your message has been sent. We will get back to you soon.',
    'id'      => $messageId,
], 201);
