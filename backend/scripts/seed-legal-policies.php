<?php

declare(strict_types=1);

/**
 * Seed / refresh legal policies from docs/legal/policies/*.md
 * Usage: php scripts/seed-legal-policies.php
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

use App\Config\Database;
use App\Helpers\LegalPolicySeeder;

$pdo = Database::pdo();
$n = LegalPolicySeeder::seedStorefrontPolicies($pdo);
echo "seed-legal-policies: upserted {$n} policy document(s).\n";
