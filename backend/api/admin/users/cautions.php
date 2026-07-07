<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\UserCautionService;
use App\Middleware\PermissionMiddleware;

PermissionMiddleware::require('issue_user_caution');
$userId = (int) ($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    Response::error('User id required.', 422);
}

Response::success([
    'cautions' => UserCautionService::historyForUser(Database::pdo(), $userId),
]);
