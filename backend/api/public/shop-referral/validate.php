<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopReferralService;

$code = trim((string) ($_GET['code'] ?? ''));
if ($code === '') {
    Response::error('Shop code is required.', 422);
}

$pdo = Database::pdo();
if (!ShopReferralService::settings($pdo)['enabled']) {
    Response::success(['valid' => false, 'message' => 'Refer-a-shop program is not active.']);
}

$result = ShopReferralService::validateCode($pdo, $code);
if (!$result['valid']) {
    Response::success(['valid' => false]);
}

Response::success($result);
