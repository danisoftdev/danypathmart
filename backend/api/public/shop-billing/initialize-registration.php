<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\Response;
use App\Helpers\ShopBillingService;

$pdo = Database::pdo();
$body = Response::body();

$applicationId = (int) ($body['application_id'] ?? 0);
$email = strtolower(trim((string) ($body['email'] ?? '')));

if ($applicationId <= 0) {
    Response::error('Application id is required.', 422);
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    Response::error('A valid email is required for payment.', 422);
}

try {
    $result = ShopBillingService::initializeRegistrationPayment($pdo, $applicationId, $email);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not start payment.', 500);
}

Response::success($result);
