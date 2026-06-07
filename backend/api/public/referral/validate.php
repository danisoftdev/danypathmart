<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\ReferralService;
use App\Helpers\Response;

$code = trim((string) ($_GET['code'] ?? ''));
if ($code === '') {
    Response::error('Referral code is required.', 422);
}

$result = ReferralService::validate(Database::pdo(), $code);

Response::success($result);
