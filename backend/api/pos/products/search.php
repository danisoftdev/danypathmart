<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosGate;
use App\Helpers\PosProductService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertUsePos($user);

$q = trim((string) ($_GET['q'] ?? ''));
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 30;

Response::success(['data' => PosProductService::search($pdo, $q, $limit)]);
