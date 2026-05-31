<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Helpers\WebAuthnService;

session_set_cookie_params([
    'path'     => '/',
    'httponly' => true,
    'secure'   => Env::isProduction(),
    'samesite' => Env::isProduction() ? 'None' : 'Lax',
]);
session_start();

$optionsJson = $_SESSION['webauthn_request'] ?? '';
if ($optionsJson === '') {
    Response::error('No active authentication challenge. Request a challenge first.', 400);
}

$raw = file_get_contents('php://input') ?: '';
$decoded = json_decode($raw, true);
$credentialJson = (is_array($decoded) && isset($decoded['credential']))
    ? json_encode($decoded['credential'])
    : $raw;

$service = new WebAuthnService();

try {
    $options = $service->requestOptionsFromJson($optionsJson);
    $credential = $service->parseCredential((string) $credentialJson);
} catch (Throwable $e) {
    error_log('WebAuthn assertion parse failed: ' . $e->getMessage());
    Response::error('Malformed authentication response.', 400);
}

$credentialId = WebAuthnService::base64url($credential->rawId);

$pdo = Database::pdo();
$stmt = $pdo->prepare(
    'SELECT c.id AS cred_pk, c.user_id, c.public_key,
            u.name, u.username, u.email, u.role, u.status, u.preferred_currency, u.totp_enabled
     FROM user_credentials c
     JOIN users u ON u.id = c.user_id
     WHERE c.credential_id = ?'
);
$stmt->execute([$credentialId]);
$row = $stmt->fetch();

if ($row === false) {
    Response::error('Unrecognised security key.', 401);
}
if ($row['status'] === 'disabled') {
    Response::error('This account has been disabled.', 403);
}

$userHandle = null;
$response = $credential->response;
if (property_exists($response, 'userHandle')) {
    $userHandle = $response->userHandle;
}

try {
    $record = $service->recordFromJson((string) $row['public_key']);
    $updated = $service->verifyAssertion($record, $options, $credential, $service->rpId(), $userHandle);
} catch (Throwable $e) {
    error_log('WebAuthn assertion failed: ' . $e->getMessage());
    Response::error('Authentication failed.', 401, [
        'debug' => Env::isProduction() ? null : $e->getMessage(),
    ]);
}

unset($_SESSION['webauthn_request']);

// Persist the updated signature counter + refreshed credential record.
$pdo->prepare('UPDATE user_credentials SET public_key = ?, sign_count = ? WHERE id = ?')
    ->execute([$service->recordToJson($updated), $updated->counter, (int) $row['cred_pk']]);

$user = [
    'id'                 => (int) $row['user_id'],
    'name'               => $row['name'],
    'username'           => $row['username'],
    'email'              => $row['email'],
    'role'               => $row['role'],
    'status'             => $row['status'],
    'preferred_currency' => $row['preferred_currency'],
    'totp_enabled'       => $row['totp_enabled'],
];

$tokens = AuthTokens::issueFor($user);
Response::success(['message' => 'Authenticated with security key.'] + $tokens);
