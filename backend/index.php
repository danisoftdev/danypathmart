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
    'POST ' . 'auth/dev-admin'             => 'auth/dev-admin.php',
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
    'GET '  . 'auth/oauth/providers'        => 'auth/oauth/providers.php',
    'POST ' . 'auth/oauth/exchange'         => 'auth/oauth/exchange.php',
    'POST ' . 'auth/oauth/token'            => 'auth/oauth/token-login.php',

    // Catalogue & search (Day 2)
    'GET '  . 'products'                    => 'products/index.php',
    'GET '  . 'products/facets'             => 'products/facets.php',
    'GET '  . 'categories'                  => 'categories/index.php',
    'GET '  . 'kits'                        => 'kits/index.php',
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
    'POST ' . 'payments/wallet'             => 'payments/wallet.php',
    'POST ' . 'payments/bank-transfer'      => 'payments/bank-transfer.php',
    'POST ' . 'payments/webhook'            => 'payments/webhook.php',
    'POST ' . 'payments/dev-confirm'        => 'payments/dev-confirm.php',

    // Image search follow-up + admin alerts (Day 3C)
    'POST ' . 'search/describe'             => 'search/describe.php',
    'GET '  . 'admin/image-alerts'          => 'admin/image-alerts/index.php',
    'GET '  . 'admin/image-alerts/count'    => 'admin/image-alerts/count.php',

    // RBAC staff management (Day 4A)
    'GET '  . 'admin/staff'                 => 'admin/staff/index.php',
    'POST ' . 'admin/staff'                 => 'admin/staff/create.php',
    'GET '  . 'admin/orders'                => 'admin/orders/index.php',
    'GET '  . 'admin/orders/export'         => 'admin/orders/export.php',
    'GET '  . 'admin/quotes/export'        => 'admin/quotes/export.php',
    'GET '  . 'admin/reports/export'       => 'admin/reports/export.php',
    'POST ' . 'admin/reports/email-export' => 'admin/reports/email-export.php',
    'GET '  . 'admin/products/export'      => 'admin/products/export.php',
    'GET '  . 'admin/products/import-template' => 'admin/products/import-template.php',
    'POST ' . 'admin/products/import'      => 'admin/products/import.php',
    'GET '  . 'admin/products'              => 'admin/products/index.php',
    'POST ' . 'admin/products'              => 'admin/products/create.php',
    'POST ' . 'admin/products/upload-image'  => 'admin/products/upload-image.php',
    'GET '  . 'admin/users'                 => 'admin/users/index.php',
    'GET '  . 'admin/notifications'        => 'admin/notifications/index.php',
    'POST ' . 'admin/notifications/send'   => 'admin/notifications/send.php',
    'GET '  . 'admin/shipping'              => 'admin/shipping/index.php',
    'PUT '  . 'admin/shipping'              => 'admin/shipping/update.php',
    'GET '  . 'admin/reports/summary'        => 'admin/reports/summary.php',
    'GET '  . 'admin/reports/financial'      => 'admin/reports/financial.php',
    'POST ' . 'admin/categories'            => 'admin/categories/create.php',

    // Company settings + public company info (Day 4C)
    'GET '  . 'admin/company-settings'      => 'admin/company-settings/index.php',
    'PUT '  . 'admin/company-settings'      => 'admin/company-settings/update.php',
    'POST ' . 'admin/company-settings/pilot-preset' => 'admin/company-settings/pilot-preset.php',
    'POST ' . 'admin/company-settings/enable-module' => 'admin/company-settings/enable-module.php',
    'GET '  . 'admin/launch-readiness'      => 'admin/launch-readiness/index.php',
    'GET '  . 'admin/hero-banners'          => 'admin/hero-banners/index.php',
    'POST ' . 'admin/hero-banners'          => 'admin/hero-banners/create.php',
    'POST ' . 'admin/hero-banners/upload-image' => 'admin/hero-banners/upload-image.php',
    'GET '  . 'admin/legal-policies'       => 'admin/legal-policies/index.php',
    'POST ' . 'admin/legal-policies'       => 'admin/legal-policies/create.php',
    'GET '  . 'admin/employees'            => 'admin/employees/index.php',
    'GET '  . 'admin/leave-requests'        => 'admin/leave-requests/index.php',
    'POST ' . 'admin/leave-requests'        => 'admin/leave-requests/create.php',
    'GET '  . 'admin/flash-sale'            => 'admin/flash-sale/index.php',
    'PUT '  . 'admin/flash-sale'            => 'admin/flash-sale/update.php',
    'GET '  . 'public/company-info'         => 'public/company-info.php',
    'GET '  . 'public/flash-sale'           => 'public/flash-sale.php',
    'POST ' . 'public/contact'             => 'public/contact.php',
    'GET '  . 'public/careers'             => 'public/careers/index.php',
    'POST ' . 'public/careers/apply'       => 'public/careers/apply.php',
    'GET '  . 'public/pickup-stations'     => 'public/pickup-stations/index.php',

    // Admin contact inbox
    'GET '  . 'admin/contact-inbox'         => 'admin/contact-inbox/index.php',
    'GET '  . 'admin/contact-inbox/count'   => 'admin/contact-inbox/count.php',
    'POST ' . 'admin/contact-inbox/read'    => 'admin/contact-inbox/read.php',
    'POST ' . 'admin/contact-inbox/delete'  => 'admin/contact-inbox/delete-bulk.php',

    // Careers (Phase M2)
    'GET '  . 'admin/job-role-types'           => 'admin/job-role-types/index.php',
    'GET '  . 'admin/job-posts'              => 'admin/job-posts/index.php',
    'POST ' . 'admin/job-posts'              => 'admin/job-posts/create.php',
    'GET '  . 'admin/career-applications'   => 'admin/career-applications/index.php',
    'GET '  . 'admin/career-applications/count' => 'admin/career-applications/count.php',
    'POST ' . 'admin/career-applications/read' => 'admin/career-applications/read.php',
    'POST ' . 'admin/career-applications/delete' => 'admin/career-applications/delete-bulk.php',

    'GET '  . 'admin/staff/permission-catalog' => 'admin/staff/permission-catalog.php',
    'GET '  . 'admin/position-permissions'    => 'admin/position-permissions/index.php',

    'GET '  . 'admin/pickup-stations'        => 'admin/pickup-stations/index.php',
    'POST ' . 'admin/pickup-stations'        => 'admin/pickup-stations/create.php',

    'GET '  . 'admin/hub-logistics'          => 'admin/hub-logistics/index.php',
    'POST ' . 'admin/hub-logistics/receive'  => 'admin/hub-logistics/receive.php',
    'POST ' . 'admin/hub-logistics/mark-ready' => 'admin/hub-logistics/mark-ready.php',
    'GET '  . 'admin/delivery-runs'          => 'admin/delivery-runs/index.php',
    'POST ' . 'admin/delivery-runs'          => 'admin/delivery-runs/create.php',
    'GET '  . 'admin/drivers'               => 'admin/drivers/index.php',
    'POST ' . 'admin/drivers'               => 'admin/drivers/create.php',
    'GET '  . 'driver/runs'                 => 'driver/runs/index.php',

    'GET '  . 'admin/station-staff'          => 'admin/station-staff/index.php',
    'POST ' . 'admin/station-staff'          => 'admin/station-staff/create.php',
    'GET '  . 'station/dashboard'            => 'station/dashboard.php',
    'GET '  . 'station/queue'                => 'station/queue/index.php',
    'POST ' . 'station/repack-complete'      => 'station/repack-complete.php',
    'POST ' . 'station/collect'             => 'station/collect.php',

    'GET '  . 'admin/promoters'                 => 'admin/promoters/index.php',
    'POST ' . 'admin/promoters'                 => 'admin/promoters/create.php',
    'GET '  . 'admin/promoter-withdrawals'      => 'admin/promoter-withdrawals/index.php',
    'GET '  . 'promoter/dashboard'              => 'promoter/dashboard.php',
    'POST ' . 'promoter/wallet/withdraw'        => 'promoter/wallet/withdraw.php',

    'GET '  . 'admin/promoters'              => 'admin/promoters/index.php',
    'POST ' . 'admin/promoters'              => 'admin/promoters/create.php',
    'GET '  . 'admin/promoter-withdrawals'   => 'admin/promoter-withdrawals/index.php',
    'GET '  . 'promoter/dashboard'           => 'promoter/dashboard.php',
    'POST ' . 'promoter/wallet/withdraw'     => 'promoter/wallet/withdraw.php',

    'GET '  . 'admin/shop-applications'      => 'admin/shop-applications/index.php',
    'GET '  . 'admin/shops'                  => 'admin/shops/index.php',
    'POST ' . 'admin/shops'                  => 'admin/shops/create.php',
    'GET '  . 'admin/marketplace/listings'   => 'admin/marketplace/listings.php',
    'GET '  . 'admin/shop-withdrawals'      => 'admin/shop-withdrawals/index.php',

    'POST ' . 'public/shop-applications/apply' => 'public/shop-applications/apply.php',
    'GET '  . 'public/shop-billing/settings' => 'public/shop-billing/settings.php',
    'POST ' . 'public/shop-billing/initialize-registration' => 'public/shop-billing/initialize-registration.php',
    'POST ' . 'public/shop-billing/dev-confirm' => 'public/shop-billing/dev-confirm.php',

    'GET '  . 'admin/shop-billing' => 'admin/shop-billing/index.php',
    'POST ' . 'admin/shop-billing/update-settings' => 'admin/shop-billing/update-settings.php',
    'POST ' . 'admin/shop-billing/waive-application' => 'admin/shop-billing/waive-application.php',
    'POST ' . 'admin/shop-billing/waive-shop' => 'admin/shop-billing/waive-shop.php',

    'GET '  . 'shop/dashboard'               => 'shop/dashboard.php',
    'POST ' . 'shop/billing/initialize-renewal' => 'shop/billing/initialize-renewal.php',
    'GET '  . 'shop/products'               => 'shop/products/index.php',
    'POST ' . 'shop/products'               => 'shop/products/create.php',
    'GET '  . 'shop/orders'                  => 'shop/orders/index.php',
    'GET '  . 'shop/wallet'                 => 'shop/wallet/index.php',
    'POST ' . 'shop/wallet/withdraw'        => 'shop/wallet/withdraw.php',
    'GET '  . 'shop/profile'                => 'shop/profile.php',
    'PUT '  . 'shop/profile'                => 'shop/profile.php',
    'POST ' . 'shop/upload-image'           => 'shop/upload-image.php',
    'POST ' . 'public/shop-applications/upload-image' => 'public/shop-applications/upload-image.php',
    'GET '  . 'public/shop-referral/validate'     => 'public/shop-referral/validate.php',

    // User dashboard: orders, settings, sessions, currency (Day 4B)
    'GET '  . 'orders'                      => 'orders/index.php',
    'GET '  . 'notifications'              => 'notifications/index.php',
    'GET '  . 'notifications/count'        => 'notifications/count.php',
    'POST ' . 'notifications/read'         => 'notifications/read.php',
    'POST ' . 'notifications/delete'       => 'notifications/delete-bulk.php',
    'GET '  . 'wishlist'                    => 'wishlist/index.php',
    'POST ' . 'wishlist/toggle'             => 'wishlist/toggle.php',
    'POST ' . 'wishlist/sync'               => 'wishlist/sync.php',
    'PUT '  . 'users/profile'               => 'users/profile.php',
    'POST ' . 'users/avatar'                => 'users/avatar.php',
    'PUT '  . 'users/currency'              => 'users/currency.php',
    'GET '  . 'users/referral'              => 'users/referral.php',
    'POST ' . 'users/email/request-change'  => 'users/email/request-change.php',
    'POST ' . 'users/email/confirm-change'  => 'users/email/confirm-change.php',
    'GET '  . 'users/sessions'              => 'users/sessions/index.php',
    'GET '  . 'public/currencies'           => 'public/currencies.php',
    'GET '  . 'public/payment-settings'     => 'public/payment-settings.php',
    'GET '  . 'public/checkout-policies'   => 'public/checkout-policies.php',
    'GET '  . 'public/hero-banners'        => 'public/hero-banners/index.php',
    'GET '  . 'public/legal-policies'      => 'public/legal-policies/index.php',
    'GET '  . 'public/referral/validate'   => 'public/referral/validate.php',
    'POST ' . 'size-guides/suggest'        => 'size-guides/suggest.php',
    'GET '  . 'admin/size-guides'          => 'admin/size-guides/index.php',
    'POST ' . 'admin/size-guides'          => 'admin/size-guides/create.php',
    'GET '  . 'admin/kits'                 => 'admin/kits/index.php',
    'POST ' . 'admin/kits'                 => 'admin/kits/create.php',
    'POST ' . 'quotes'                      => 'quotes/create.php',
    'GET '  . 'quotes'                      => 'quotes/index.php',
    'GET '  . 'public/institutional-features' => 'public/institutional-features.php',
    'GET '  . 'admin/quotes'               => 'admin/quotes/index.php',
    'POST ' . 'stock-alerts/subscribe'       => 'stock-alerts/subscribe.php',
    'POST ' . 'stock-alerts/unsubscribe'     => 'stock-alerts/unsubscribe.php',
    'GET '  . 'stock-alerts/status'          => 'stock-alerts/status.php',
    'POST ' . 'custom-proofs/upload'         => 'custom-proofs/upload.php',
    'GET '  . 'admin/custom-proofs'           => 'admin/custom-proofs/index.php',
    'GET '  . 'wallet'                       => 'wallet/index.php',
];

$key = $method . ' ' . $route;
$handlerFile = $routes[$key] ?? null;

// Dynamic route: GET auth/oauth/{provider} — start OAuth redirect
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^auth/oauth/(google|microsoft|apple)$#', $route, $m) === 1) {
    $_GET['provider'] = $m[1];
    $handlerFile = 'auth/oauth/start.php';
}

// Dynamic route: GET auth/oauth/{provider}/callback
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^auth/oauth/(google|microsoft|apple)/callback$#', $route, $m) === 1) {
    $_GET['provider'] = $m[1];
    $handlerFile = 'auth/oauth/callback-get.php';
}

// Dynamic route: POST auth/oauth/apple/callback (Apple form_post)
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^auth/oauth/apple/callback$#', $route) === 1) {
    $_GET['provider'] = 'apple';
    $handlerFile = 'auth/oauth/callback-post.php';
}

// Dynamic route: DELETE admin/contact-inbox/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/contact-inbox/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/contact-inbox/delete.php';
}

// Dynamic route: PUT admin/job-posts/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/job-posts/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/job-posts/update.php';
}

// Dynamic route: DELETE admin/job-posts/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/job-posts/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/job-posts/delete.php';
}

// Dynamic route: POST admin/career-applications/{id}/hire
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/career-applications/([0-9]+)/hire$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/career-applications/hire.php';
}

// Dynamic route: PUT admin/position-permissions/{slug}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/position-permissions/([a-z0-9_]+)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'admin/position-permissions/update.php';
}

// Dynamic route: PUT admin/pickup-stations/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/pickup-stations/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/pickup-stations/update.php';
}

// Dynamic route: DELETE admin/pickup-stations/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/pickup-stations/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/pickup-stations/delete.php';
}

// Dynamic route: GET admin/delivery-runs/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/delivery-runs/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/delivery-runs/show.php';
}

// Dynamic route: POST admin/delivery-runs/{id}/dispatch
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/delivery-runs/([0-9]+)/dispatch$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/delivery-runs/dispatch.php';
}

// Dynamic route: POST driver/runs/{run_id}/confirm-stop
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^driver/runs/([0-9]+)/confirm-stop$#', $route, $m) === 1) {
    $_GET['run_id'] = $m[1];
    $handlerFile = 'driver/runs/confirm-stop.php';
}

// Dynamic route: POST admin/promoters/{id}/status
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/promoters/([0-9]+)/status$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/promoters/status.php';
}

// Dynamic route: POST admin/promoter-withdrawals/{id}/process
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/promoter-withdrawals/([0-9]+)/process$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/promoter-withdrawals/process.php';
}

// Dynamic route: POST admin/shop-applications/{id}/approve
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/shop-applications/([0-9]+)/approve$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/shop-applications/approve.php';
}

// Dynamic route: POST admin/shop-applications/{id}/reject
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/shop-applications/([0-9]+)/reject$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/shop-applications/reject.php';
}

// Dynamic route: PUT admin/shops/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/shops/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/shops/update.php';
}

// Dynamic route: POST admin/marketplace/listings/{id}/review
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/marketplace/listings/([0-9]+)/review$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/marketplace/review-listing.php';
}

// Dynamic route: POST admin/marketplace/listings/{id}/moderate-badge
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/marketplace/listings/([0-9]+)/moderate-badge$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/marketplace/moderate-badge.php';
}

// Dynamic route: POST admin/shop-withdrawals/{id}/process
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/shop-withdrawals/([0-9]+)/process$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/shop-withdrawals/process.php';
}

// Dynamic route: PUT shop/products/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^shop/products/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'shop/products/update.php';
}

// Dynamic route: GET public/shops/{slug}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^public/shops/([a-z0-9-]+)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'public/shops/show.php';
}

// Dynamic route: DELETE admin/career-applications/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/career-applications/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/career-applications/delete.php';
}

// Dynamic route: GET admin/career-applications/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/career-applications/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/career-applications/show.php';
}

// Dynamic route: GET public/careers/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^public/careers/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'public/careers/show.php';
}

// Dynamic route: DELETE notifications/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^notifications/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'notifications/delete.php';
}

// Dynamic route: GET quotes/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^quotes/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'quotes/show.php';
}

// Dynamic route: POST quotes/{id}/convert
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^quotes/([0-9]+)/convert$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'quotes/convert.php';
}

// Dynamic route: GET admin/quotes/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/quotes/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/quotes/show.php';
}

// Dynamic route: POST admin/quotes/{id}/proforma
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/quotes/([0-9]+)/proforma$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/quotes/proforma.php';
}

// Dynamic route: POST admin/quotes/{id}/approve-pay-later
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/quotes/([0-9]+)/approve-pay-later$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/quotes/approve-pay-later.php';
}

// Dynamic route: POST admin/quotes/{id}/reject
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/quotes/([0-9]+)/reject$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/quotes/reject.php';
}

// Dynamic route: GET kits/{slug}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^kits/([A-Za-z0-9][A-Za-z0-9_\-]*)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'kits/show.php';
}

// Dynamic route: GET products/{slug}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^products/([A-Za-z0-9][A-Za-z0-9\-]*)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'products/show.php';
}

// Dynamic route: POST orders/{id}/cancel
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^orders/([0-9]+)/cancel$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'orders/cancel.php';
}

// Dynamic route: GET orders/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^orders/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'orders/show.php';
}

// Dynamic route: POST admin/custom-proofs/{id}
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/custom-proofs/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/custom-proofs/update.php';
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

// Dynamic route: GET admin/orders/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/orders/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/show.php';
}

// Dynamic route: POST admin/orders/{id}/cancel
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/orders/([0-9]+)/cancel$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/cancel.php';
}

// Dynamic route: POST admin/orders/{id}/revive
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/orders/([0-9]+)/revive$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/revive.php';
}

// Dynamic route: POST admin/orders/{id}/confirm-bank-transfer
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/orders/([0-9]+)/confirm-bank-transfer$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/confirm-bank-transfer.php';
}

// Dynamic route: POST admin/orders/{id}/wallet-refund
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/orders/([0-9]+)/wallet-refund$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/wallet-refund.php';
}

// Dynamic route: POST admin/orders/{id}/status
if ($handlerFile === null && $method === 'POST'
    && preg_match('#^admin/orders/([0-9]+)/status$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/orders/update-status.php';
}

// Dynamic route: PUT admin/users/{id}/status
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/users/([0-9]+)/status$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/users/update-status.php';
}

// Dynamic route: GET admin/size-guides/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/size-guides/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/size-guides/show.php';
}

// Dynamic route: PUT admin/size-guides/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/size-guides/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/size-guides/update.php';
}

// Dynamic route: DELETE admin/size-guides/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/size-guides/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/size-guides/delete.php';
}

// Dynamic route: GET admin/kits/{id}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^admin/kits/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/kits/show.php';
}

// Dynamic route: PUT admin/kits/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/kits/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/kits/update.php';
}

// Dynamic route: DELETE admin/kits/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/kits/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/kits/delete.php';
}

// Dynamic route: PUT admin/products/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/products/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/products/update.php';
}

// Dynamic route: DELETE admin/products/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/products/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/products/delete.php';
}

// Dynamic route: GET public/legal-policies/{slug}
if ($handlerFile === null && $method === 'GET'
    && preg_match('#^public/legal-policies/([a-z0-9-]+)$#', $route, $m) === 1) {
    $_GET['slug'] = $m[1];
    $handlerFile = 'public/legal-policies/show.php';
}

// Dynamic route: PUT/DELETE admin/hero-banners/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/hero-banners/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/hero-banners/update.php';
}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/hero-banners/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/hero-banners/delete.php';
}

// Dynamic route: PUT/DELETE admin/legal-policies/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/legal-policies/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/legal-policies/update.php';
}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/legal-policies/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/legal-policies/delete.php';
}

// Dynamic route: PUT admin/employees/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/employees/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/employees/update.php';
}

// Dynamic route: PUT admin/leave-requests/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/leave-requests/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/leave-requests/update.php';
}

// Dynamic route: PUT admin/categories/{id}
if ($handlerFile === null && $method === 'PUT'
    && preg_match('#^admin/categories/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/categories/update.php';
}

// Dynamic route: DELETE admin/categories/{id}
if ($handlerFile === null && $method === 'DELETE'
    && preg_match('#^admin/categories/([0-9]+)$#', $route, $m) === 1) {
    $_GET['id'] = $m[1];
    $handlerFile = 'admin/categories/delete.php';
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
