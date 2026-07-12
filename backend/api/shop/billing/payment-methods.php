<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopBillingReceiptService;
use App\Helpers\ShopBillingService;
use App\Middleware\ShopMiddleware;

$ctx = ShopMiddleware::requireShopMember();
$pdo = Database::pdo();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    Response::success([
        'methods' => ShopBillingReceiptService::listPaymentMethods($pdo, $ctx['shop_id']),
    ]);
}

if ($method === 'POST') {
    $body = Response::body();
    $action = trim((string) ($body['action'] ?? 'setup'));

    if ($action === 'default') {
        $id = (int) ($body['method_id'] ?? 0);
        if (!ShopBillingReceiptService::setDefaultPaymentMethod($pdo, $ctx['shop_id'], $id)) {
            Response::error('Card not found.', 404);
        }
        Response::success([
            'message' => 'Default card updated.',
            'methods' => ShopBillingReceiptService::listPaymentMethods($pdo, $ctx['shop_id']),
        ]);
    }

    $email = (string) ($ctx['user']['email'] ?? '');
    if ($email === '') {
        Response::error('Your account needs an email to add a card.', 422);
    }

    try {
        $init = ShopBillingService::initializeCardSetup($pdo, $ctx['shop_id'], $email);
    } catch (\Throwable $e) {
        Response::error($e->getMessage(), 422);
    }

    Response::success([
        'message' => 'Complete card setup on Paystack.',
        'payment' => $init,
    ]);
}

if ($method === 'DELETE') {
    $body = Response::body();
    $id = (int) ($body['method_id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0 || !ShopBillingReceiptService::removePaymentMethod($pdo, $ctx['shop_id'], $id)) {
        Response::error('Card not found.', 404);
    }
    Response::success([
        'message' => 'Card removed.',
        'methods' => ShopBillingReceiptService::listPaymentMethods($pdo, $ctx['shop_id']),
    ]);
}

Response::error('Method not allowed', 405);
