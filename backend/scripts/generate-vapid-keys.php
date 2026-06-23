<?php

declare(strict_types=1);

/**
 * Generate VAPID key pair for Web Push.
 * Run: php backend/scripts/generate-vapid-keys.php
 */

require __DIR__ . '/../vendor/autoload.php';

if (!class_exists(\Minishlink\WebPush\VAPID::class)) {
    fwrite(STDERR, "Run: composer require minishlink/web-push\n");
    exit(1);
}

$keys = \Minishlink\WebPush\VAPID::createVapidKeys();

echo "Add to public_html/api/.env:\n";
echo 'VAPID_PRIVATE_KEY=' . $keys['privateKey'] . "\n";
echo 'VAPID_SUBJECT=mailto:support@danypathmart.store' . "\n\n";

echo "Add to company_settings (public key only):\n";
echo $keys['publicKey'] . "\n";
