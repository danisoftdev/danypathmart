<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CareerService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings']);

$pdo = Database::pdo();

$cols = CareerService::postsSelectColumns();
$from = CareerService::postsFromJoin();
$rows = $pdo->query(
    "SELECT {$cols} FROM {$from} ORDER BY p.is_active DESC, p.created_at DESC"
)->fetchAll();

$data = array_map(static function (array $r) use ($pdo): array {
    $id = (int) $r['id'];
    return CareerService::formatJobPost($r, CareerService::loadFieldsForPost($pdo, $id), $pdo);
}, $rows);

Response::success(['data' => $data]);
