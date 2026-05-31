<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

AuthMiddleware::requireAdmin();

$pending = (int) Database::pdo()->query(
    "SELECT COUNT(*) FROM image_search_alerts WHERE status = 'pending'"
)->fetchColumn();

Response::success(['pending_count' => $pending]);
