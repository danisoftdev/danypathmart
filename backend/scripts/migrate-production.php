<?php

declare(strict_types=1);

/**
 * Production database update — run on Hostinger after schema+seed import.
 *
 *   cd public_html/api && php scripts/migrate-production.php
 *
 * Runs all SQL migrations (001–049+) then phase M4 column guards (idempotent).
 */

$root = __DIR__;
$fail = false;

echo "DanyPathMart — migrate-production\n";
echo str_repeat('=', 50) . "\n\n";

passthru('php ' . escapeshellarg($root . '/migrate-all.php'), $code);
if ($code !== 0) {
    $fail = true;
}

echo "\n";
passthru('php ' . escapeshellarg($root . '/migrate-phase-m4.php'), $code);
if ($code !== 0) {
    $fail = true;
}

echo "\n" . str_repeat('=', 50) . "\n";
if ($fail) {
    echo "migrate-production finished with errors — review output above.\n";
    exit(1);
}

echo "migrate-production complete.\n";
exit(0);
