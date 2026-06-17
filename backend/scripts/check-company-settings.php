<?php

declare(strict_types=1);

/**
 * Quick company settings diagnostic (no auth — DB + public API only).
 *
 *   cd public_html/api && php scripts/check-company-settings.php
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
use App\Config\Env;
use App\Helpers\CompanySettingsService;

Env::load();
$pdo = Database::pdo();

echo "Company settings diagnostic\n";
echo str_repeat('=', 50) . "\n";

try {
    $row = $pdo->query(
        'SELECT company_name, email, phone, facebook, instagram, twitter, whatsapp_group, paystack_enabled
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
} catch (\Throwable $e) {
    echo "FAIL: company_settings query — " . $e->getMessage() . "\n";
    echo "Run: php scripts/migrate-all.php\n";
    exit(1);
}

if ($row === false) {
    echo "FAIL: No company_settings row — import seed.sql or save once in Admin.\n";
    exit(1);
}

echo "OK  company_name: " . ($row['company_name'] ?? '') . "\n";
echo "    email: " . ($row['email'] ?? '(empty)') . "\n";
echo "    phone: " . ($row['phone'] ?? '(empty)') . "\n";
echo "    facebook: " . ($row['facebook'] ? 'set' : 'empty') . "\n";
echo "    instagram: " . ($row['instagram'] ? 'set' : 'empty') . "\n";
echo "    twitter: " . ($row['twitter'] ? 'set' : 'empty') . "\n";
echo "    whatsapp_group: " . ($row['whatsapp_group'] ? 'set' : 'empty') . "\n";
echo "    paystack_enabled: " . ((int) ($row['paystack_enabled'] ?? 1) === 1 ? 'yes' : 'no') . "\n";

try {
    $imgRow = $pdo->query('SELECT image_search_enabled FROM company_settings ORDER BY id ASC LIMIT 1')->fetch();
    $img = $imgRow['image_search_enabled'] ?? 0;
    echo "    image_search_enabled: " . ((int) $img === 1 ? 'yes' : 'no') . "\n";
} catch (\Throwable) {
    echo "    image_search_enabled: column missing — run migration 050\n";
}

$appUrl = rtrim((string) Env::get('APP_URL', ''), '/');
$origin = rtrim((string) Env::get('CORS_ORIGIN', ''), '/');
if ($origin !== '') {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]);
    $body = @file_get_contents($origin . '/api/public/company-info', false, $ctx);
    if ($body !== false) {
        $json = json_decode($body, true);
        $co = $json['company'] ?? [];
        echo "\nPublic /company-info:\n";
        echo "    facebook in API: " . (!empty($co['facebook']) ? 'set' : 'empty') . "\n";
        echo "    whatsapp_group in API: " . (!empty($co['whatsapp_group']) ? 'set' : 'empty') . "\n";
    }
}

try {
    $settings = CompanySettingsService::loadForAdmin($pdo);
    echo "\nOK  CompanySettingsService::loadForAdmin — " . count($settings) . " keys\n";
    echo "    company_name: " . ($settings['company_name'] ?? '') . "\n";
} catch (\Throwable $e) {
    echo "\nFAIL: CompanySettingsService::loadForAdmin — " . $e->getMessage() . "\n";
    exit(1);
}

echo "\nAdmin API requires JWT — test in browser after login.\n";
exit(0);
