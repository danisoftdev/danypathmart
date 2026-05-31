<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AuthTokens;
use App\Helpers\Response;

$refresh = $_COOKIE[AuthTokens::REFRESH_COOKIE] ?? '';
if ($refresh !== '') {
    Database::pdo()
        ->prepare('DELETE FROM user_sessions WHERE refresh_token_hash = ?')
        ->execute([hash('sha256', $refresh)]);
}

AuthTokens::clearRefreshCookie();
Response::success(['message' => 'Logged out.']);
