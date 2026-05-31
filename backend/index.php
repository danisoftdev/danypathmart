<?php

declare(strict_types=1);

/*
 * DanyPathMart REST API - front controller / router.
 * Hostinger maps this file to public_html/api/index.php and rewrites
 * /api/{path} -> index.php?route={path} via .htaccess.
 */

// Dev only: when running under `php -S ... -t backend index.php`, let the
// built-in server serve existing static files (e.g. /uploads/*) directly.
if (PHP_SAPI === 'cli-server') {
    $staticPath = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if ($staticPath !== '' && $staticPath !== '/' && is_file(__DIR__ . $staticPath)) {
        return false;
    }
}

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
    'POST ' . 'auth/forgot-password'       => 'auth/forgot-password.php',
    'POST ' . 'auth/reset-password'        => 'auth/reset-password.php',
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
    'GET '  . 'auth/webauthn/credentials'   => 'auth/webauthn/credentials.php',
    'POST ' . 'auth/change-password'        => 'auth/change-password.php',

    // Catalogue & search (Day 2)
    'GET '  . 'products'                    => 'products/index.php',
    'GET '  . 'categories'                  => 'categories/index.php',
    'GET '  . 'search/autocomplete'         => 'search/autocomplete.php',
    'GET '  . 'search'                      => 'search/index.php',
    'POST ' . 'search/image'                => 'search/image.php',

    // Checkout, orders & payments (Day 3B)
    'GET '  . 'shipping/calculate'          => 'shipping/calculate.php',
    'POST ' . 'shipping/calculate'          => 'shipping/calculate.php',
    'GET '  . 'addresses'                   => 'addresses/index.php',
    'POST ' . 'addresses'                   => 'addresses/create.php',
    'POST ' . 'orders'                      => 'orders/create.php',
    'POST ' . 'payments/initialize'         => 'payments/initialize.php',
    'POST ' . 'payments/webhook'            => 'payments/webhook.php',
    'POST ' . 'payments/dev-confirm'        => 'payments/dev-confirm.php',

    // Image search follow-up + admin alerts (Day 3C)
    'POST ' . 'search/describe'             => 'search/describe.php',
    'GET '  . 'admin/image-alerts'          => 'admin/image-alerts/index.php',
    'GET '  . 'admin/image-alerts/count'    => 'admin/image-alerts/count.php',

    // RBAC staff management (Day 4A)
    'GET '  . 'admin/staff'                 => 'admin/staff/index.php',
    'POST ' . 'admin/staff'                 => 'admin/staff/create.php',

    // Company settings + public company info (Day 4C)
    'GET '  . 'admin/company-settings'      => 'admin/company-settings/index.php',
    'PUT '  . 'admin/company-settings'      => 'admin/company-settings/update.php',
    'GET '  . 'public/company-info'         => 'public/company-info.php',

    // User dashboard: orders, settings, sessions, currency (Day 4B)
    'GET '  . 'orders'                      => 'orders/index.php',
    'PUT '  . 'users/profile'               => 'users/profile.php',
    'POST ' . 'users/avatar'                => 'users/avatar.php',
    'PUT '  . 'users/currency'              => 'users/currency.php',
    'POST ' . 'users/email/request-change'  => 'users/email/request-change.php',
    'POST ' . 'users/email/confirm-change'  => 'users/email/confirm-change.php',
    'GET '  . 'users/sessions'              => 'users/sessions/index.php',
    'GET '  . 'public/currencies'           => 'public/currencies.php',
];

$key = $method . ' ' . $route;
$handlerFile = $routes[$key] ?? null;

// Dynamic route: GET products/{slug}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^products/([A-Za-z0-9][A-Za-z0-9\-]*)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'products/show.php';
}

// Dynamic route: GET orders/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^orders/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'orders/show.php';
}

// Dynamic route: POST admin/image-alerts/{id}
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/image-alerts/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/image-alerts/update.php';
}

// Dynamic route: PUT admin/staff/{id}/permissions
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/staff/([0-9]+)/permissions$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/staff/permissions.php';
}

// Dynamic route: DELETE admin/staff/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/staff/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/staff/delete.php';
}

// Dynamic route: DELETE users/sessions/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^users/sessions/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'users/sessions/delete.php';
}

// Dynamic route: DELETE auth/webauthn/credentials/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^auth/webauthn/credentials/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'auth/webauthn/credential-delete.php';
}

// Dynamic route: POST addresses/{id}/default
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^addresses/([0-9]+)/default$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'addresses/set-default.php';
}

// Dynamic route: PUT addresses/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^addresses/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'addresses/update.php';
}

// Dynamic route: DELETE addresses/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^addresses/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'addresses/delete.php';
}

if ($handlerFile === null) {
    Response::error('Route not found: ' . $key, 404);
}

$handler = __DIR__ . '/api/' . $handlerFile;
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
