<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Response;
use App\Helpers\WebAuthnService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

session_set_cookie_params([
    'path'     => '/',
    'httponly' => true,
    'secure'   => Env::isProduction(),
    'samesite' => Env::isProduction() ? 'None' : 'Lax',
]);
session_start();

$optionsJson = $_SESSION['webauthn_create'] ?? '';
if ($optionsJson === '') {
    Response::error('No active registration challenge. Request a challenge first.', 400);
}

// Accept either the raw credential JSON or a { credential, device_name } envelope.
$raw = file_get_contents('php://input') ?: '';
$decoded = json_decode($raw, true);
$deviceName = 'Security key';
if (is_array($decoded) && isset($decoded['credential'])) {
    $deviceName = (string) ($decoded['device_name'] ?? $deviceName);
    $credentialJson = json_encode($decoded['credential']);
} else {
    $credentialJson = $raw;
}

$service = new WebAuthnService();

try {
    $options = $service->creationOptionsFromJson($optionsJson);
    $credential = $service->parseCredential((string) $credentialJson);
    $record = $service->verifyRegistration($options, $credential, $service->rpId());
} catch (Throwable $e) {
    error_log('WebAuthn register failed: ' . $e->getMessage());
    Response::error('Could not verify the security key. Please try again.', 400, [
        'debug' => Env::isProduction() ? null : $e->getMessage(),
    ]);
}

unset($_SESSION['webauthn_create']);

$credentialId = WebAuthnService::base64url($record->publicKeyCredentialId);

$pdo = Database::pdo();
$exists = $pdo->prepare('SELECT 1 FROM user_credentials WHERE credential_id = ?');
$exists->execute([$credentialId]);
if ($exists->fetchColumn() !== false) {
    Response::error('This device is already registered.', 409);
}

$stmt = $pdo->prepare(
    'INSERT INTO user_credentials (user_id, credential_id, public_key, sign_count, device_name)
     VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([
    (int) $user['id'],
    $credentialId,
    $service->recordToJson($record),
    $record->counter,
    substr($deviceName, 0, 120),
]);

Response::success([
    'message'     => 'Security key registered successfully.',
    'credential'  => [
        'id'          => (int) $pdo->lastInsertId(),
        'device_name' => $deviceName,
    ],
], 201);
