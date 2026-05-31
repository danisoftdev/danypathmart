<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShippingService;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::authenticate();
$pdo = Database::pdo();
$body = Response::body();

$items = $body['items'] ?? null;
if (!is_array($items) || $items === []) {
    Response::error('Your cart is empty.', 422, ['code' => 'empty_cart']);
}

$addressId = isset($body['address_id']) ? (int) $body['address_id'] : 0;
if ($addressId > 0) {
    $chk = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
    $chk->execute([$addressId, $user['id']]);
    if ($chk->fetchColumn() === false) {
        Response::error('Delivery address not found.', 422, ['code' => 'bad_address']);
    }
} else {
    $addressId = null;
}

$notes = isset($body['notes']) ? trim((string) $body['notes']) : '';

// Server recomputes everything from the database (prices, freight, stock).
$quote = ShippingService::quote($pdo, $items, true);

if ($quote['errors'] !== []) {
    Response::error('Some items are unavailable or out of stock.', 422, [
        'code'   => 'cart_invalid',
        'errors' => $quote['errors'],
    ]);
}
if ($quote['lines'] === []) {
    Response::error('Your cart is empty.', 422, ['code' => 'empty_cart']);
}

$pdo->beginTransaction();
try {
    $orderStmt = $pdo->prepare(
        'INSERT INTO orders
            (user_id, address_id, status, subtotal, intl_shipping_cost,
             local_delivery_cost, local_delivery_percent, total, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $orderStmt->execute([
        $user['id'],
        $addressId,
        'placed',
        $quote['subtotal'],
        $quote['intl_shipping_cost'],
        $quote['local_delivery_cost'],
        $quote['local_delivery_percent'],
        $quote['total'],
        'pending',
        $notes !== '' ? $notes : null,
    ]);
    $orderId = (int) $pdo->lastInsertId();

    $itemStmt = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, is_preorder, estimated_arrival)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($quote['lines'] as $line) {
        $itemStmt->execute([
            $orderId,
            (int) $line['product']['id'],
            (int) $line['quantity'],
            $line['unit_price'],
            $line['is_preorder'] ? 1 : 0,
            $line['estimated_arrival'],
        ]);

        // Reserve stock for in-stock items (pre-orders are sourced on demand).
        if (!$line['is_preorder']) {
            $pdo->prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?')
                ->execute([(int) $line['quantity'], (int) $line['product']['id']]);
        }
    }

    $pdo->prepare(
        "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'placed', ?, ?)"
    )->execute([$orderId, 'Order placed, awaiting payment.', $user['id']]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

Response::success([
    'order_id' => $orderId,
    'total'    => $quote['total'],
    'currency' => $quote['currency'],
], 201);
