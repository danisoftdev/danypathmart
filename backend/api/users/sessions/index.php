<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

$currentHash = '';
$cookie = $_COOKIE[AuthTokens::REFRESH_COOKIE] ?? '';
if ($cookie !== '') {
    $currentHash = hash('sha256', $cookie);
}

$stmt = $pdo->prepare(
    'SELECT id, refresh_token_hash, device_info, ip_address, last_used, created_at, expires_at
     FROM user_sessions
     WHERE user_id = ? AND expires_at > NOW()
     ORDER BY last_used DESC'
);
$stmt->execute([(int) $user['id']]);

$sessions = array_map(static function (array $row) use ($currentHash): array {
    $ua = (string) ($row['device_info'] ?? '');
    return [
        'id'         => (int) $row['id'],
        'device'     => detect_device($ua),
        'browser'    => detect_browser($ua),
        'ip_address' => $row['ip_address'],
        'last_used'  => $row['last_used'],
        'created_at' => $row['created_at'],
        'is_current' => $currentHash !== '' && hash_equals($currentHash, (string) $row['refresh_token_hash']),
    ];
}, $stmt->fetchAll());

Response::success(['data' => $sessions]);

function detect_browser(string $ua): string
{
    return match (true) {
        str_contains($ua, 'Edg')                                  => 'Edge',
        str_contains($ua, 'OPR') || str_contains($ua, 'Opera')    => 'Opera',
        str_contains($ua, 'Chrome')                               => 'Chrome',
        str_contains($ua, 'Firefox')                              => 'Firefox',
        str_contains($ua, 'Safari')                               => 'Safari',
        $ua === '' || $ua === 'unknown'                           => 'Unknown',
        default                                                   => 'Browser',
    };
}

function detect_device(string $ua): string
{
    return match (true) {
        str_contains($ua, 'iPhone')                               => 'iPhone',
        str_contains($ua, 'iPad')                                 => 'iPad',
        str_contains($ua, 'Android')                              => 'Android device',
        str_contains($ua, 'Windows')                              => 'Windows PC',
        str_contains($ua, 'Macintosh') || str_contains($ua, 'Mac OS') => 'Mac',
        str_contains($ua, 'Linux')                                => 'Linux',
        default                                                   => 'Unknown device',
    };
}
