<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\UserCautionService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$cautionId = (int) ($body['caution_id'] ?? 0);
if ($cautionId <= 0) {
    Response::error('Invalid caution.', 422);
}

UserCautionService::acknowledge($pdo, (int) $user['id'], $cautionId);

Response::success(['message' => 'Acknowledged.']);
