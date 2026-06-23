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

$body = Response::body();
$items = is_array($body['items'] ?? null) ? $body['items'] : [];
$discount = isset($body['discount_amount']) ? (float) $body['discount_amount'] : 0.0;

$quote = PosProductService::quote($pdo, $items, $discount);
Response::success($quote);
