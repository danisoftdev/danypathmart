<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;

final class Jwt
{
    private const ALGO = 'HS256';

    private static function secret(): string
    {
        Env::load();
        return (string) Env::get('JWT_SECRET', 'dev-insecure-secret-change-me-now');
    }

    /**
     * @param array<string,mixed> $claims
     */
    public static function issueAccess(array $claims): string
    {
        $ttl = Env::int('JWT_EXPIRY', 900);
        $now = time();
        $payload = $claims + [
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttl,
            'iss' => Env::get('APP_URL', 'http://localhost'),
        ];

        return FirebaseJwt::encode($payload, self::secret(), self::ALGO);
    }

    /**
     * @return array<string,mixed>
     */
    public static function decode(string $token): array
    {
        $decoded = FirebaseJwt::decode($token, new Key(self::secret(), self::ALGO));
        return (array) $decoded;
    }
}
