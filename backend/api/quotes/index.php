<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();

Response::success(['data' => QuoteService::listForUser($pdo, (int) $user['id'])]);
