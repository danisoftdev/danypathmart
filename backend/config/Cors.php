<?php

declare(strict_types=1);

namespace App\Config;

final class Cors
{
    public static function apply(): void
    {
        Env::load();

        $allowed = Env::get('CORS_ORIGIN', 'http://localhost:5173');
        $allowList = array_map('trim', explode(',', (string) $allowed));
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if ($origin !== '' && in_array($origin, $allowList, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Vary: Origin');
        } elseif (count($allowList) === 1 && $allowList[0] !== '*') {
            header("Access-Control-Allow-Origin: {$allowList[0]}");
        }

        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Max-Age: 86400');

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
