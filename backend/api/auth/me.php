<?php

declare(strict_types=1);

use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();

Response::success(['user' => AuthTokens::publicUser($user)]);
