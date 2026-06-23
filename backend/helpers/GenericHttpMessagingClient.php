<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;

/**
 * Provider-agnostic SMS / WhatsApp via HTTP.
 * Configure URL, headers, and JSON body templates in .env — works with any REST API.
 *
 * Placeholders: {{phone}}, {{message}}, {{api_key}}, {{title}}
 */
final class GenericHttpMessagingClient
{
    public static function isSmsConfigured(): bool
    {
        return trim((string) Env::get('SMS_API_URL', '')) !== '';
    }

    public static function isWhatsAppConfigured(): bool
    {
        return trim((string) Env::get('WHATSAPP_API_URL', '')) !== '';
    }

    /** @return array{ok:bool,status:int,body:string,error:?string} */
    public static function sendSms(string $phone, string $message, ?string $title = null): array
    {
        return self::send('sms', $phone, $message, $title);
    }

    /** @return array{ok:bool,status:int,body:string,error:?string} */
    public static function sendWhatsApp(string $phone, string $message, ?string $title = null): array
    {
        return self::send('whatsapp', $phone, $message, $title);
    }

    /** @return array{ok:bool,status:int,body:string,error:?string} */
    private static function send(string $channel, string $phone, string $message, ?string $title): array
    {
        $prefix = strtoupper($channel === 'whatsapp' ? 'WHATSAPP' : 'SMS');
        $url = trim((string) Env::get("{$prefix}_API_URL", ''));
        if ($url === '') {
            return ['ok' => false, 'status' => 0, 'body' => '', 'error' => "{$channel} API URL not configured."];
        }

        $normalized = self::normalizePhone($phone);
        if ($normalized === '') {
            return ['ok' => false, 'status' => 0, 'body' => '', 'error' => 'Invalid phone number.'];
        }

        $dryRun = self::isTruthy(Env::get("{$prefix}_API_DRY_RUN", ''));
        if ($dryRun) {
            error_log("[DPM {$channel} dry-run] to {$normalized}: {$message}");

            return ['ok' => true, 'status' => 200, 'body' => 'dry-run', 'error' => null];
        }

        $apiKey = trim((string) Env::get("{$prefix}_API_KEY", Env::get("{$prefix}_API_TOKEN", '')));
        $method = strtoupper(trim((string) Env::get("{$prefix}_API_METHOD", 'POST')));
        if (!in_array($method, ['POST', 'GET', 'PUT', 'PATCH'], true)) {
            $method = 'POST';
        }

        $headersRaw = trim((string) Env::get("{$prefix}_API_HEADERS", ''));
        $headers = $headersRaw !== ''
            ? self::decodeJson($headersRaw, "{$prefix}_API_HEADERS")
            : ['Content-Type' => 'application/json'];

        $bodyTemplate = trim((string) Env::get("{$prefix}_API_BODY", ''));
        if ($bodyTemplate === '') {
            $bodyTemplate = $channel === 'whatsapp'
                ? '{"to":"{{phone}}","message":"{{message}}"}'
                : '{"to":"{{phone}}","message":"{{message}}"}';
        }

        $replacements = [
            '{{phone}}'    => $normalized,
            '{{message}}'  => $message,
            '{{title}}'    => $title ?? '',
            '{{api_key}}'  => $apiKey,
        ];

        $url = strtr($url, $replacements);
        foreach ($headers as $k => $v) {
            $headers[$k] = strtr((string) $v, $replacements);
        }
        $body = strtr($bodyTemplate, $replacements);

        return self::httpRequest($method, $url, $headers, $body);
    }

    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }

        $defaultCode = preg_replace('/\D+/', '', (string) Env::get('SMS_DEFAULT_COUNTRY_CODE', '233')) ?? '233';
        if ($defaultCode === '') {
            $defaultCode = '233';
        }

        if (str_starts_with($digits, '0')) {
            $digits = $defaultCode . substr($digits, 1);
        } elseif (strlen($digits) === 9 && !str_starts_with($digits, $defaultCode)) {
            $digits = $defaultCode . $digits;
        }

        return $digits;
    }

    /** @return array<string,string> */
    private static function decodeJson(string $json, string $label): array
    {
        try {
            $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            throw new \InvalidArgumentException("Invalid JSON in {$label}: " . $e->getMessage());
        }
        if (!is_array($decoded)) {
            throw new \InvalidArgumentException("{$label} must be a JSON object.");
        }

        $out = [];
        foreach ($decoded as $k => $v) {
            if (is_string($k) && (is_string($v) || is_numeric($v))) {
                $out[$k] = (string) $v;
            }
        }

        return $out;
    }

    /** @param array<string,string> $headers */
    private static function httpRequest(string $method, string $url, array $headers, string $body): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'status' => 0, 'body' => '', 'error' => 'PHP curl extension required.'];
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return ['ok' => false, 'status' => 0, 'body' => '', 'error' => 'curl_init failed.'];
        }

        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headerLines,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_POSTFIELDS     => $method === 'GET' ? null : $body,
        ]);

        $responseBody = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false) {
            return ['ok' => false, 'status' => $status, 'body' => '', 'error' => $err ?: 'HTTP request failed.'];
        }

        $ok = $status >= 200 && $status < 300;
        if (!$ok) {
            error_log("[DPM messaging] HTTP {$status}: " . substr((string) $responseBody, 0, 500));
        }

        return [
            'ok'     => $ok,
            'status' => $status,
            'body'   => (string) $responseBody,
            'error'  => $ok ? null : "HTTP {$status}",
        ];
    }

    private static function isTruthy(mixed $value): bool
    {
        if ($value === null || $value === false) {
            return false;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }
}
