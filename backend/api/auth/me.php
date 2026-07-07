<?php

declare(strict_types=1);

use App\Helpers\AuthTokens;
use App\Helpers\Response;
use App\Helpers\UserCautionService;
use App\Middleware\AuthMiddleware;
use App\Config\Database;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$pendingCautions = UserCautionService::pendingForUser($pdo, (int) $user['id']);

Response::success([
    'user'             => AuthTokens::publicUser($user),
    'pending_cautions' => $pendingCautions,
]);
