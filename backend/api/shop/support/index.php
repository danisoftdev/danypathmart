<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SupportChatService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$status = isset($_GET['status']) ? (string) $_GET['status'] : 'open';

Response::success(['data' => SupportChatService::listForShop($pdo, $ctx['shop_id'], $status)]);
