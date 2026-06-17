<?php

declare(strict_types=1);

/**
 * Standalone Google Vision diagnostic — upload to api/scripts/ and run on production:
 *
 *   cd ~/domains/danypathmart.store/public_html/api
 *   php scripts/test-vision.php
 *   php scripts/test-vision.php /path/to/photo.jpg
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
use App\Helpers\ImageSearchService;

Env::load();

echo "Google Vision API diagnostic\n";
echo str_repeat('=', 50) . "\n";

$key = trim((string) Env::get('GOOGLE_VISION_API_KEY', ''));
if ($key === '' || str_contains($key, 'xxxx')) {
    echo "FAIL: GOOGLE_VISION_API_KEY missing in .env\n";
    exit(1);
}
echo "Key: " . substr($key, 0, 8) . '...' . substr($key, -4) . " (length " . strlen($key) . ")\n";

$imagePath = $argv[1] ?? '';
if ($imagePath === '' || !is_file($imagePath)) {
    $candidates = [
        dirname(__DIR__, 2) . '/brand/logo.png',
        '/home/u161582953/domains/danypathmart.store/public_html/brand/logo.png',
    ];
    foreach ($candidates as $c) {
        if (is_file($c)) {
            $imagePath = $c;
            break;
        }
    }
}

if ($imagePath === '' || !is_file($imagePath)) {
    $tmp = sys_get_temp_dir() . '/dpm-vision-test.jpg';
    $bytes = @file_get_contents('https://danypathmart.store/brand/logo.png');
    if ($bytes !== false && strlen($bytes) > 100) {
        file_put_contents($tmp, $bytes);
        $imagePath = $tmp;
        echo "Downloaded test image from site logo\n";
    }
}

if ($imagePath === '' || !is_file($imagePath)) {
    echo "FAIL: No image — pass a path: php scripts/test-vision.php /path/to/photo.jpg\n";
    exit(1);
}

echo "Image: {$imagePath} (" . filesize($imagePath) . " bytes)\n\n";

if (method_exists(ImageSearchService::class, 'probe')) {
    $probe = ImageSearchService::probe($imagePath);
    echo "HTTP: " . ($probe['http'] ?: 'n/a') . "\n";
    if ($probe['ok']) {
        echo "OK — labels: " . implode(', ', $probe['labels']) . "\n";
        exit(0);
    }
    echo "FAIL: " . $probe['error'] . "\n";
} else {
    echo "Note: upload helpers/ImageSearchService.php (probe method) for richer output.\n";
    $labels = ImageSearchService::detectLabels($imagePath);
    if ($labels !== []) {
        echo "OK — labels: " . implode(', ', $labels) . "\n";
        exit(0);
    }
    echo "FAIL: detectLabels returned empty — check PHP error_log for Vision API HTTP response\n";
}

echo "\n--- How to fix (most common) ---\n";
echo "1. Google Cloud Console → APIs → enable 'Cloud Vision API'\n";
echo "2. Link a billing account to the project (Vision requires billing)\n";
echo "3. APIs & Services → Credentials → your API key:\n";
echo "   - Application restrictions: None (or IP: your server IP)\n";
echo "   - NOT 'HTTP referrers' — that blocks server-side PHP calls\n";
echo "   - API restrictions: Cloud Vision API (or unrestricted)\n";
echo "4. Wait 2–5 minutes after changes, then re-run this script\n";
exit(1);
