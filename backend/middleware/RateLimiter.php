<?php

declare(strict_types=1);

namespace App\Middleware;

final class RateLimiter
{
    /**
     * File-based fixed-window limiter.
     *
     * @return array{allowed:bool,remaining:int,retry_after:int}
     */
    public static function hit(string $key, int $maxAttempts, int $windowSeconds): array
    {
        $dir = dirname(__DIR__) . '/storage/ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $file = $dir . '/' . hash('sha256', $key) . '.json';
        $now = time();

        $data = ['count' => 0, 'reset' => $now + $windowSeconds];
        if (is_file($file)) {
            $raw = json_decode((string) file_get_contents($file), true);
            if (is_array($raw) && isset($raw['reset']) && (int) $raw['reset'] > $now) {
                $data = $raw;
            }
        }

        $data['count'] = (int) $data['count'] + 1;
        @file_put_contents($file, json_encode($data), LOCK_EX);

        return [
            'allowed'     => $data['count'] <= $maxAttempts,
            'remaining'   => max(0, $maxAttempts - (int) $data['count']),
            'retry_after' => max(0, (int) $data['reset'] - $now),
        ];
    }

    public static function clientIp(): string
    {
        $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($forwarded !== '') {
            $parts = explode(',', $forwarded);
            return trim($parts[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? 'cli';
    }
}
