<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\TOTPService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

$secret = TOTPService::generateSecret();
Database::pdo()
    ->prepare('UPDATE users SET totp_secret_pending = ? WHERE id = ?')
    ->execute([$secret, (int) $user['id']]);

Response::success([
    'secret'  => $secret,
    'qr_uri'  => TOTPService::provisioningUri($secret, (string) $user['email']),
    'issuer'  => TOTPService::ISSUER,
    'account' => $user['email'],
    'message' => 'Scan the QR code with your authenticator app, then confirm with a code.',
]);
