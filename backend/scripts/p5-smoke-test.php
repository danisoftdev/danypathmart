<?php



declare(strict_types=1);



/**

 * P5 extended API smoke test — health, storefront CMS, and catalog endpoints.

 *

 * Usage:

 *   php backend/scripts/p5-smoke-test.php

 *   php backend/scripts/p5-smoke-test.php https://danypathmart.store/api

 */



$base = $argv[1] ?? (getenv('APP_URL') ?: 'http://localhost:8000');

$base = rtrim($base, '/');



$paths = [

    'GET /health'                   => '/health',

    'GET /public/company-info'      => '/public/company-info',

    'GET /public/checkout-policies' => '/public/checkout-policies',

    'GET /public/hero-banners'      => '/public/hero-banners',

    'GET /public/legal-policies'    => '/public/legal-policies',

    'GET /public/payment-settings'  => '/public/payment-settings',

    'GET /products'                 => '/products?per_page=1',

    'GET /categories'               => '/categories',

];



echo "DanyPathMart P5 smoke test\nBase: {$base}\n" . str_repeat('-', 50) . "\n";



$failed = 0;

foreach ($paths as $label => $path) {

    $url = $base . $path;

    $ctx = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]);

    $body = @file_get_contents($url, false, $ctx);

    $code = 0;

    if (isset($http_response_header[0]) && preg_match('/\d{3}/', $http_response_header[0], $m)) {

        $code = (int) $m[0];

    }

    $ok = $body !== false && $code >= 200 && $code < 300;

    if (!$ok) {

        $failed++;

    }

    echo ($ok ? '  OK ' : ' FAIL ') . "{$label} → HTTP {$code}\n";



    if ($ok && str_contains($path, 'company-info') && $body !== false) {

        $json = json_decode($body, true);

        $company = $json['company'] ?? $json['data']['company'] ?? [];

        $analytics = $json['analytics'] ?? $json['data']['analytics'] ?? null;

        echo '       company: ' . ($company['company_name'] ?? '(missing)') . "\n";

        if (is_array($analytics) && !empty($analytics['enabled'])) {

            echo '       analytics: ' . ($analytics['measurement_id'] ?? 'enabled') . "\n";

        }

    }



    if ($ok && str_contains($path, 'health') && $body !== false) {

        $json = json_decode($body, true);

        $db = $json['db'] ?? $json['data']['db'] ?? null;

        if ($db === false) {

            echo "       WARNING: health reports db=false\n";

            $failed++;

        }

    }

}



if (is_file(__DIR__ . '/../.env')) {

    echo "\nLaunch readiness (all phases):\n";

    passthru('php ' . escapeshellarg(__DIR__ . '/launch-readiness-cli.php'), $readyCode);

    if (isset($readyCode) && $readyCode !== 0) {

        $failed++;

    }

}



echo "\n" . ($failed === 0 ? "P5 smoke endpoints OK.\n" : "{$failed} check(s) failed.\n");

exit($failed > 0 ? 1 : 0);

