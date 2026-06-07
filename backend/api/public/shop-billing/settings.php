<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;

$pdo = Database::pdo();
Response::success(['settings' => ShopBillingService::publicSettings($pdo)]);
