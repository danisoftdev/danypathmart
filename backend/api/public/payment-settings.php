<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PaymentSettings;
use App\Helpers\Response;

$pdo = Database::pdo();
$settings = PaymentSettings::get($pdo);
$methods = PaymentSettings::enabledMethodLabels($pdo);
$bank = PaymentSettings::bankDetails($pdo);

Response::success([
    'methods'              => $methods,
    'pay_before_delivery'  => $settings['pay_before_delivery'],
    'currency'             => 'GHS',
    'bank'                 => $bank,
]);
