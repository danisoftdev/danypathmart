<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Jwt;
use App\Helpers\Response;
use App\Helpers\WebAuthnService;

// Cross-origin friendly session (same-site on localhost; same-origin in prod).
session_set_cookie_params([
    'path'     => '/',
    'httponly' => true,
    'secure'   => Env::isProduction(),
    'samesite' => Env::isProduction() ? 'None' : 'Lax',
]);
session_start();

$service = new WebAuthnService();

// Optionally identify the caller from a Bearer token (registration flow).
$user = null;
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}
if (preg_match('/Bearer\s+(\S+)/i', (string) $auth, $m) === 1) {
    try {
        $claims = Jwt::decode(trim($m[1]));
        $stmt = Database::pdo()->prepare(
            'SELECT id, name, username, email FROM users WHERE id = ?'
        );
        $stmt->execute([(int) ($claims['sub'] ?? 0)]);
        $found = $stmt->fetch();
        if ($found !== false) {
            $user = $found;
        }
    } catch (Throwable $e) {
        $user = null;
    }
}

if ($user !== null) {
    $options = $service->createOptions($user);
    $json = $service->toJson($options);
    $_SESSION['webauthn_create'] = $json;
    unset($_SESSION['webauthn_request']);

    Response::success([
        'mode'      => 'register',
        'publicKey' => json_decode($json, true),
    ]);
}

$options = $service->requestOptions();
$json = $service->toJson($options);
$_SESSION['webauthn_request'] = $json;
unset($_SESSION['webauthn_create']);

Response::success([
    'mode'      => 'authenticate',
    'publicKey' => json_decode($json, true),
]);
