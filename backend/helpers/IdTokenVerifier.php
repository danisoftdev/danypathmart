<?php

declare(strict_types=1);

namespace App\Helpers;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use stdClass;

/** Validates OIDC id_tokens from Google, Microsoft, and Apple. */
final class IdTokenVerifier
{
    /**
     * @return array{sub:string,email:?string,email_verified:bool,name:?string}
     */
    public static function verify(string $idToken, string $provider): array
    {
        $config = self::providerConfig($provider);
        if ($config === null) {
            throw new \InvalidArgumentException('Unknown OAuth provider.');
        }

        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new \RuntimeException('Invalid id_token format.');
        }

        $header = json_decode(self::b64UrlDecode($parts[0]), true);
        if (!is_array($header) || empty($header['kid'])) {
            throw new \RuntimeException('Invalid id_token header.');
        }

        $jwks = self::fetchJwks($config['jwks_url']);
        $keys = JWK::parseKeySet($jwks);
        /** @var stdClass $payload */
        $payload = JWT::decode($idToken, $keys);

        $claims = (array) $payload;
        $now = time();

        if (($claims['exp'] ?? 0) < $now) {
            throw new \RuntimeException('id_token has expired.');
        }

        $aud = $claims['aud'] ?? null;
        if (is_array($aud)) {
            if (!in_array($config['client_id'], $aud, true)) {
                throw new \RuntimeException('id_token audience mismatch.');
            }
        } elseif ((string) $aud !== $config['client_id']) {
            throw new \RuntimeException('id_token audience mismatch.');
        }

        $iss = (string) ($claims['iss'] ?? '');
        if ($provider === 'microsoft') {
            if (!str_starts_with($iss, 'https://login.microsoftonline.com/') || !str_ends_with($iss, '/v2.0')) {
                throw new \RuntimeException('id_token issuer mismatch.');
            }
        } elseif (!in_array($iss, $config['issuers'], true)) {
            throw new \RuntimeException('id_token issuer mismatch.');
        }

        $email = isset($claims['email']) ? strtolower(trim((string) $claims['email'])) : null;
        if ($email === '') {
            $email = null;
        }

        $emailVerified = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $name = isset($claims['name']) ? trim((string) $claims['name']) : null;
        if ($name === '') {
            $name = null;
        }

        return [
            'sub'             => (string) ($claims['sub'] ?? ''),
            'email'           => $email,
            'email_verified'  => $emailVerified,
            'name'            => $name,
        ];
    }

    /**
     * @return array{client_id:string,jwks_url:string,issuers:array<int,string>}|null
     */
    private static function providerConfig(string $provider): ?array
    {
        return match ($provider) {
            'google' => [
                'client_id' => (string) Env::get('GOOGLE_OAUTH_CLIENT_ID', ''),
                'jwks_url'  => 'https://www.googleapis.com/oauth2/v3/certs',
                'issuers'   => ['https://accounts.google.com', 'accounts.google.com'],
            ],
            'microsoft' => [
                'client_id' => (string) Env::get('MICROSOFT_OAUTH_CLIENT_ID', ''),
                'jwks_url'  => 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
                'issuers'   => [
                    'https://login.microsoftonline.com/' . Env::get('MICROSOFT_OAUTH_TENANT', 'common') . '/v2.0',
                    'https://login.microsoftonline.com/common/v2.0',
                ],
            ],
            'apple' => [
                'client_id' => (string) Env::get('APPLE_OAUTH_CLIENT_ID', ''),
                'jwks_url'  => 'https://appleid.apple.com/auth/keys',
                'issuers'   => ['https://appleid.apple.com'],
            ],
            default => null,
        };
    }

    /** @return array<string,mixed> */
    private static function fetchJwks(string $url): array
    {
        $json = self::httpGet($url);
        $data = json_decode($json, true);
        if (!is_array($data) || !isset($data['keys'])) {
            throw new \RuntimeException('Could not load provider signing keys.');
        }

        return $data;
    }

    private static function httpGet(string $url): string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_FOLLOWLOCATION => true,
            ]);
            $body = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($body === false || $code >= 400) {
                throw new \RuntimeException('HTTP request failed.');
            }
            return (string) $body;
        }

        $ctx = stream_context_create(['http' => ['timeout' => 15]]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            throw new \RuntimeException('HTTP request failed.');
        }

        return $body;
    }

    private static function b64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        if ($decoded === false) {
            throw new \RuntimeException('Invalid base64 in id_token.');
        }

        return $decoded;
    }
}
