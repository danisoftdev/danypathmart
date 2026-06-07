<?php

declare(strict_types=1);

/**
 * Pre-flight checks before production deploy (P0).
 * Usage: php backend/scripts/check-production-env.php
 *
 * Exits 0 when all checks pass, 1 when any blocking issue is found.
 */

require __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));
    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Env;

$errors = [];
$warnings = [];

$env = strtolower(trim((string) Env::get('APP_ENV', 'dev')));
if ($env !== 'production') {
    $warnings[] = 'APP_ENV is not "production" (current: ' . ($env ?: 'unset') . ').';
}

$bypass = strtolower(trim((string) Env::get('DEV_ADMIN_BYPASS', '0')));
if (in_array($bypass, ['1', 'true', 'yes', 'on'], true)) {
    $errors[] = 'DEV_ADMIN_BYPASS must be off in production (set to 0 or remove).';
}

$jwt = trim((string) Env::get('JWT_SECRET', ''));
if ($jwt === '' || str_contains($jwt, 'change_this')) {
    $errors[] = 'JWT_SECRET must be a long random value (not the example placeholder).';
}

$cors = trim((string) Env::get('CORS_ORIGIN', ''));
if ($cors === '' || str_contains($cors, 'localhost')) {
    $errors[] = 'CORS_ORIGIN must be your live site URL (https://danypathmart.store), not localhost.';
}

$appUrl = trim((string) Env::get('APP_URL', ''));
if ($appUrl === '' || str_contains($appUrl, 'localhost')) {
    $errors[] = 'APP_URL must be your live API URL (e.g. https://danypathmart.store/api).';
}

$paystack = trim((string) Env::get('PAYSTACK_SECRET_KEY', ''));
if ($paystack === '' || str_contains($paystack, 'xxxxxxxx')) {
    $warnings[] = 'PAYSTACK_SECRET_KEY looks unset or placeholder — use live key for real payments.';
} elseif (str_starts_with($paystack, 'sk_test_')) {
    $warnings[] = 'PAYSTACK_SECRET_KEY is test mode (sk_test_) — switch to sk_live_ for production.';
}

$smtpHost = trim((string) Env::get('SMTP_HOST', ''));
if ($smtpHost === '') {
    $warnings[] = 'SMTP_HOST is empty — password reset and order emails may not send.';
}

$rpId = trim((string) Env::get('WEBAUTHN_RP_ID', ''));
if ($env === 'production' && ($rpId === '' || $rpId === 'localhost')) {
    $errors[] = 'WEBAUTHN_RP_ID must be your production domain (e.g. danypathmart.store).';
}

echo "DanyPathMart — production env check\n";
echo str_repeat('-', 40) . "\n";

if ($warnings !== []) {
    echo "\nWarnings:\n";
    foreach ($warnings as $w) {
        echo "  ⚠ {$w}\n";
    }
}

if ($errors !== []) {
    echo "\nBlocking issues:\n";
    foreach ($errors as $e) {
        echo "  ✗ {$e}\n";
    }
    echo "\nFix backend/.env (or server api/.env) then re-run.\n";
    exit(1);
}

echo "\nAll blocking checks passed.\n";
if ($warnings !== []) {
    echo "Review warnings above before go-live.\n";
}
exit(0);
