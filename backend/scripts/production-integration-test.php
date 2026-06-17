<?php

declare(strict_types=1);

/**
 * Production integration tests — run on Hostinger over SSH (uses api/.env).
 *
 *   cd public_html/api
 *   php scripts/production-integration-test.php
 *   php scripts/production-integration-test.php --email=you@example.com
 *   php scripts/production-integration-test.php --skip-paystack
 *
 * Tests: categories API data, SMTP send, Google Vision image labels, Paystack API key.
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
use App\Helpers\ImageSearchService;
use App\Helpers\Mailer;

$opts = getopt('', ['email:', 'skip-paystack', 'skip-smtp', 'skip-vision', 'image:']);
$toEmail = isset($opts['email']) ? trim((string) $opts['email']) : '';
$skipPaystack = array_key_exists('skip-paystack', $opts);
$skipSmtp = array_key_exists('skip-smtp', $opts);
$skipVision = array_key_exists('skip-vision', $opts);

$failed = 0;
$passed = 0;

function line(string $status, string $message): void
{
    $icon = match ($status) {
        'pass' => 'OK  ',
        'fail' => 'FAIL',
        'warn' => 'WARN',
        default => '....',
    };
    echo "  [{$icon}] {$message}\n";
}

function record(string $status, string $message): void
{
    global $failed, $passed;
    line($status, $message);
    if ($status === 'fail') {
        $failed++;
    } elseif ($status === 'pass') {
        $passed++;
    }
}

echo "DanyPathMart — production integration test\n";
echo str_repeat('=', 50) . "\n";
Env::load();

// --- 1. Categories (homepage buttons) ---
echo "\n1. Categories (homepage)\n";
try {
    $pdo = Database::pdo();
    $count = (int) $pdo->query('SELECT COUNT(*) FROM categories WHERE parent_id IS NULL')->fetchColumn();
    if ($count >= 1) {
        $names = $pdo->query('SELECT name FROM categories WHERE parent_id IS NULL ORDER BY name ASC LIMIT 8')
            ->fetchAll(PDO::FETCH_COLUMN);
        record('pass', "Top-level categories in DB: {$count} — " . implode(', ', array_map('strval', $names)));
    } else {
        record('fail', 'No top-level categories — import seed.sql or add in Admin → Categories');
    }
} catch (Throwable $e) {
    record('fail', 'Categories query: ' . $e->getMessage());
}

$appUrl = rtrim((string) Env::get('APP_URL', 'http://localhost:8000'), '/');
$apiBase = str_ends_with($appUrl, '/api') ? $appUrl : $appUrl . '/api';
$ctx = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]);
$catBody = @file_get_contents($apiBase . '/categories', false, $ctx);
if ($catBody !== false) {
    $catJson = json_decode($catBody, true);
    $apiCount = is_array($catJson['data'] ?? null) ? count($catJson['data']) : 0;
    if ($apiCount >= 1) {
        record('pass', "GET /categories returns {$apiCount} top-level item(s)");
    } else {
        record('fail', 'GET /categories returned empty data');
    }
} else {
    record('warn', 'Could not HTTP-fetch /categories — check APP_URL in .env');
}

// --- 2. SMTP / outbound email ---
echo "\n2. Outbound email (SMTP)\n";
if ($skipSmtp) {
    line('warn', 'Skipped (--skip-smtp)');
} else {
    $smtpHost = trim((string) Env::get('SMTP_HOST', ''));
    $smtpUser = trim((string) Env::get('SMTP_USER', ''));
    $smtpPort = Env::int('SMTP_PORT', 587);
    if ($smtpHost === '') {
        record('fail', 'SMTP_HOST is empty — emails will dump to storage/mail only');
    } else {
        record('pass', "SMTP_HOST={$smtpHost}, port={$smtpPort}, SMTP_USER={$smtpUser}");
    }

    if ($smtpHost !== '' && str_contains($smtpHost, 'hostinger') && str_contains($smtpUser, '@gmail.com')) {
        record('fail', 'Gmail address with Hostinger SMTP — set SMTP_HOST=smtp.gmail.com (not smtp.hostinger.com)');
    }
    if ($smtpHost !== '' && str_contains($smtpHost, 'gmail') && !str_contains($smtpUser, '@gmail.com')) {
        record('warn', 'SMTP_HOST is Gmail but SMTP_USER is not a @gmail.com address');
    }
    $smtpPass = (string) Env::get('SMTP_PASS', '');
    if ($smtpHost !== '' && $smtpPass === '') {
        record('fail', 'SMTP_PASS is empty');
    }
    if ($smtpHost !== '' && str_contains($smtpHost, 'gmail') && strlen(str_replace(' ', '', $smtpPass)) < 16) {
        record('warn', 'Gmail needs a 16-character App Password (not your normal Gmail password)');
    }

    $recipient = $toEmail !== '' ? $toEmail : trim((string) Env::get('ADMIN_EMAIL', ''));
    if ($recipient === '') {
        record('warn', 'No --email= and no ADMIN_EMAIL — skipping send test');
    } else {
        $subject = 'DanyPathMart production SMTP test ' . date('Y-m-d H:i:s');
        $html = '<p>If you received this, outbound SMTP from <strong>danypathmart.store</strong> works.</p>';
        $ok = Mailer::send($recipient, 'DanyPathMart Admin', $subject, $html, 'SMTP test from production-integration-test.php');
        if ($ok) {
            if ($smtpHost === '') {
                record('warn', 'No SMTP — email saved under storage/mail/ (not sent to inbox)');
            } else {
                record('pass', "Test email sent to {$recipient} — check inbox/spam");
            }
        } else {
            $detail = Mailer::lastError() ?? 'unknown error';
            record('fail', "Mailer::send failed: {$detail}");
            if (str_contains($detail, 'authenticate') || str_contains($detail, 'Authentication')) {
                if (str_contains($smtpHost, 'gmail')) {
                    line('warn', 'Gmail: use an App Password (Google Account → Security → App passwords), not your login password');
                } else {
                    line('warn', 'Hostinger: use a @danypathmart.store mailbox password in SMTP_PASS');
                }
            }
        }
    }
}

echo "\n   Receiving: reply to the test email manually; the app does not auto-read inbox.\n";

// --- 3. Google Vision (image search) ---
echo "\n3. Image search (Google Vision API)\n";
if ($skipVision) {
    line('warn', 'Skipped (--skip-vision)');
} else {
    if (!ImageSearchService::isConfigured()) {
        record('fail', 'GOOGLE_VISION_API_KEY missing or placeholder in .env');
    } else {
        record('pass', 'GOOGLE_VISION_API_KEY is set');
        $imagePath = isset($opts['image']) ? (string) $opts['image'] : '';
        if ($imagePath === '' || !is_file($imagePath)) {
            $candidates = [
                dirname(__DIR__, 2) . '/brand/logo.png',
                dirname(__DIR__, 2) . '/frontend/public/brand/logo.png',
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
            record('warn', 'No test image found — pass --image=/path/to/photo.jpg');
        } else {
            line('....', 'Using image: ' . $imagePath);
            $probe = ImageSearchService::probe($imagePath);
            if ($probe['ok']) {
                record('pass', 'Vision labels: ' . implode(', ', array_slice($probe['labels'], 0, 8)));
            } else {
                record('fail', $probe['error'] !== '' ? $probe['error'] : 'Vision probe failed');
                if ($probe['http'] === 403) {
                    line('warn', '403: enable Cloud Vision API + billing; remove HTTP-referrer-only restriction on API key (use IP or unrestricted for server)');
                } elseif ($probe['http'] === 400) {
                    line('warn', '400: API key invalid or Vision API not enabled in Google Cloud Console');
                }
            }
        }
    }
}

// --- 4. Paystack ---
echo "\n4. Paystack API\n";
if ($skipPaystack) {
    line('warn', 'Skipped (--skip-paystack)');
} else {
    $secret = trim((string) Env::get('PAYSTACK_SECRET_KEY', ''));
    $public = trim((string) Env::get('PAYSTACK_PUBLIC_KEY', ''));
    if ($secret === '' || str_contains($secret, 'xxxx')) {
        record('fail', 'PAYSTACK_SECRET_KEY not set');
    } else {
        $mode = str_starts_with($secret, 'sk_live_') ? 'live' : 'test';
        record('pass', "Secret key present ({$mode} mode)");
    }
    if ($public === '' || str_contains($public, 'xxxx')) {
        record('warn', 'PAYSTACK_PUBLIC_KEY not set (needed for frontend checkout)');
    } else {
        $pkMode = str_starts_with($public, 'pk_live_') ? 'live' : 'test';
        record('pass', "Public key present ({$pkMode} mode)");
    }

    if ($secret !== '' && !str_contains($secret, 'xxxx')) {
        $ch = curl_init('https://api.paystack.co/balance');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $secret,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr !== '') {
            record('fail', 'Paystack curl error: ' . $curlErr);
        } elseif ($httpCode === 200 && is_string($response)) {
            $json = json_decode($response, true);
            if (($json['status'] ?? false) === true) {
                $bal = $json['data'][0]['balance'] ?? $json['data']['balance'] ?? '?';
                $currency = $json['data'][0]['currency'] ?? $json['data']['currency'] ?? 'GHS';
                record('pass', "Paystack API OK — balance query succeeded ({$currency})");
            } else {
                record('fail', 'Paystack returned status=false: ' . substr($response, 0, 120));
            }
        } else {
            record('fail', "Paystack HTTP {$httpCode} — wrong secret key or network block");
        }
    }
}

echo "\n" . str_repeat('=', 50) . "\n";
echo "Passed: {$passed} | Failed: {$failed}\n";
if ($failed > 0) {
    echo "Fix failures above, then re-run.\n";
    exit(1);
}
echo "All integration checks passed.\n";
exit(0);
