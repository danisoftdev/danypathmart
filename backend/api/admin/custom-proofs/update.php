<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CustomProofService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Proof not found.', 404);
}

$proof = CustomProofService::review(
    Database::pdo(),
    $id,
    (int) $user['id'],
    Response::body()
);

Response::success(['proof' => $proof]);
