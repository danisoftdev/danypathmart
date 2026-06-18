<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterService;
use App\Helpers\PromoterWalletService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$ctx = AuthMiddleware::requirePromoter();
$pdo = Database::pdo();

$data = PromoterService::dashboard($pdo, $ctx['promoter_id']);
$data['transactions'] = PromoterWalletService::listTransactions($pdo, $ctx['promoter_id']);

Response::success($data);
