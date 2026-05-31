<?php

declare(strict_types=1);

/*
 * DanyPathMart REST API - front controller / router.
 * Hostinger maps this file to public_html/api/index.php and rewrites
 * /api/{path} -> index.php?route={path} via .htaccess.
 */

require __DIR__ . '/vendor/autoload.php';

// Lightweight PSR-4-ish autoloader for the project's own classes.
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));          // config | helpers | middleware
    $path = __DIR__ . '/' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Cors;
use App\Config\Env;
use App\Helpers\Response;

Env::load();
Cors::apply();

$route = trim((string) ($_GET['route'] ?? ''), '/');
if ($route === '') {
    $uriPath = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $uriPath = preg_replace('#^.*?/api/#', '', $uriPath) ?? '';
    $route = trim($uriPath, '/');
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$routes = [
    'GET '  . 'health'                     => 'health.php',
    'POST ' . 'auth/register'              => 'auth/register.php',
    'POST ' . 'auth/verify-email'          => 'auth/verify-email.php',
    'POST ' . 'auth/resend-otp'            => 'auth/resend-otp.php',
    'POST ' . 'auth/login'                 => 'auth/login.php',
    'POST ' . 'auth/refresh'               => 'auth/refresh.php',
    'POST ' . 'auth/logout'                => 'auth/logout.php',
    'GET '  . 'auth/me'                     => 'auth/me.php',
    'POST ' . 'auth/2fa/setup'              => 'auth/2fa/setup.php',
    'POST ' . 'auth/2fa/confirm'            => 'auth/2fa/confirm.php',
    'POST ' . 'auth/2fa/verify'             => 'auth/2fa/verify.php',
    'POST ' . 'auth/2fa/backup'             => 'auth/2fa/backup.php',
    'POST ' . 'auth/2fa/disable'            => 'auth/2fa/disable.php',
    'GET '  . 'auth/webauthn/challenge'     => 'auth/webauthn/challenge.php',
    'POST ' . 'auth/webauthn/register'      => 'auth/webauthn/register.php',
    'POST ' . 'auth/webauthn/authenticate'  => 'auth/webauthn/authenticate.php',
];

$key = $method . ' ' . $route;
if (!isset($routes[$key])) {
    Response::error('Route not found: ' . $key, 404);
}

$handler = __DIR__ . '/api/' . $routes[$key];
if (!is_file($handler)) {
    Response::error('Route handler missing on server', 500);
}

try {
    require $handler;
} catch (Throwable $e) {
    error_log('Unhandled API error: ' . $e->getMessage());
    $debug = Env::isProduction() ? [] : ['debug' => $e->getMessage()];
    Response::error('Internal server error', 500, $debug);
}
