<?php

declare(strict_types=1);

/**
 * Production database update — run on Hostinger after deploy.
 *
 *   cd ~/domains/danypathmart.store/public_html/api
 *   php scripts/migrate-production.php
 *
 * Prefer PHP_BINARY so Hostinger shared hosting finds the same CLI binary.
 * Falls back to telling you to run migrate-all.php directly if spawning is blocked.
 */

$root = __DIR__;
$fail = false;

echo "DanyPathMart — migrate-production\n";
echo str_repeat('=', 50) . "\n\n";
flush();

/**
 * @return int exit code (0 = ok)
 */
function runCliScript(string $scriptPath): int
{
    if (!is_file($scriptPath)) {
        fwrite(STDERR, "ERROR: script not found: {$scriptPath}\n");
        return 1;
    }

    $php = 'php';
    if (defined('PHP_BINARY') && is_string(PHP_BINARY) && PHP_BINARY !== '') {
        // Hostinger sometimes sets PHP_BINARY to php-fpm; only use it if it looks like CLI.
        $base = strtolower(basename(PHP_BINARY));
        if (!str_contains($base, 'fpm') && !str_contains($base, 'cgi')) {
            $php = PHP_BINARY;
        }
    }

    $cmd = escapeshellarg($php) . ' ' . escapeshellarg($scriptPath) . ' 2>&1';
    echo "→ Running: {$cmd}\n";
    flush();

    if (function_exists('passthru')) {
        $code = 0;
        passthru($cmd, $code);
        return (int) $code;
    }

    if (function_exists('proc_open')) {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $proc = proc_open($cmd, $descriptors, $pipes, dirname($scriptPath));
        if (!is_resource($proc)) {
            fwrite(STDERR, "ERROR: could not start PHP subprocess.\n");
            return 1;
        }
        fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]) ?: '';
        $err = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($proc);
        echo $out;
        if ($err !== '') {
            fwrite(STDERR, $err);
        }
        return (int) $code;
    }

    fwrite(STDERR, "ERROR: passthru/proc_open disabled on this host.\n");
    fwrite(STDERR, "Run this instead:\n");
    fwrite(STDERR, "  php " . basename($scriptPath) . "\n");
    fwrite(STDERR, "(from the api/scripts directory, or: php scripts/" . basename($scriptPath) . ")\n");
    return 1;
}

$code = runCliScript($root . '/migrate-all.php');
if ($code !== 0) {
    $fail = true;
    echo "\nWARNING: migrate-all exited with code {$code}\n";
}

echo "\n";
flush();

$code = runCliScript($root . '/migrate-phase-m4.php');
if ($code !== 0) {
    $fail = true;
    echo "\nWARNING: migrate-phase-m4 exited with code {$code}\n";
}

echo "\n" . str_repeat('=', 50) . "\n";
if ($fail) {
    echo "migrate-production finished with errors — review output above.\n";
    echo "Tip: from this api folder run directly:\n";
    echo "  php scripts/migrate-all.php\n";
    exit(1);
}

echo "migrate-production complete.\n";
exit(0);
