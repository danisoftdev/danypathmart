<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use RuntimeException;

/** Shop-link checkout: single shop, shop-owned payments, 0% commission. */
final class StorefrontOrderService
{
    public static function unpaidTimeoutHours(PDO $pdo): int
    {
        try {
            $v = $pdo->query(
                'SELECT storefront_unpaid_timeout_hours FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetchColumn();
        } catch (\Throwable) {
            return 48;
        }

        return max(1, min(168, (int) ($v ?: 48)));
    }

    /** @return array<string,mixed> */
    public static function paymentMethodsForShop(PDO $pdo, array $shop): array
    {
        $verified = !empty($shop['verified_at']);
        $methods = [];

        if (!empty($shop['payment_paystack_enabled']) && $verified && !empty($shop['paystack_subaccount_code'])) {
            $methods[] = [
                'id'    => 'paystack',
                'label' => 'Pay online (card / MoMo)',
            ];
        }
        if (!empty($shop['payment_momo_enabled']) && trim((string) ($shop['momo_number'] ?? '')) !== '') {
            $methods[] = [
                'id'          => 'momo',
                'label'       => 'Mobile Money (manual)',
                'momo_number' => $shop['momo_number'],
            ];
        }
        if (!empty($shop['payment_physical_enabled'])) {
            $methods[] = [
                'id'    => 'physical',
                'label' => 'Pay in person at shop',
            ];
        }

        return $methods;
    }

    /**
     * @param list<array{product_id:int,quantity:int}> $items
     * @return array{order_id:int,total:float,payment_method:string,requires_online_payment:bool,momo_number?:string}
     */
    public static function createOrder(
        PDO $pdo,
        int $userId,
        string $shopSlug,
        array $items,
        string $paymentMethod,
        string $fulfillmentMode = 'delivery',
        ?int $addressId = null,
        ?string $notes = null
    ): array {
        if (UserCautionService::userIsRestricted($pdo, $userId)) {
            throw new RuntimeException('Your account is restricted. Contact support.');
        }

        $shop = ShopService::findBySlug($pdo, $shopSlug);
        if ($shop === null) {
            throw new RuntimeException('Shop not found or inactive.');
        }

        $methods = self::paymentMethodsForShop($pdo, $shop);
        $allowed = array_column($methods, 'id');
        if (!in_array($paymentMethod, $allowed, true)) {
            throw new RuntimeException('This payment method is not available for this shop.');
        }

        if (!in_array($fulfillmentMode, ['delivery', 'shop_pickup'], true)) {
            $fulfillmentMode = 'delivery';
        }

        $quote = ShippingService::quote($pdo, $items, true, null, null, $fulfillmentMode);
        if ($quote['errors'] !== [] || $quote['lines'] === []) {
            throw new RuntimeException('Some items are unavailable.');
        }
        if (!empty($quote['has_dpm_items'])) {
            throw new RuntimeException('Store checkout only supports products from this shop.');
        }

        $shopIds = [];
        foreach ($quote['lines'] as $line) {
            $sid = (int) ($line['product']['shop_id'] ?? 0);
            if ($sid > 0) {
                $shopIds[$sid] = true;
            }
        }
        if (count($shopIds) !== 1 || !isset($shopIds[(int) $shop['id']])) {
            throw new RuntimeException('All items must be from the same shop.');
        }

        if ($fulfillmentMode === 'shop_pickup') {
            if (empty($shop['allows_shop_pickup']) || empty($shop['has_map_pin'])) {
                throw new RuntimeException('Shop pickup is not available.');
            }
            $addressId = null;
        } elseif ($addressId === null || $addressId <= 0) {
            throw new RuntimeException('Delivery address is required.');
        } else {
            $chk = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
            $chk->execute([$addressId, $userId]);
            if ($chk->fetchColumn() === false) {
                throw new RuntimeException('Delivery address not found.');
            }
        }

        $total = round((float) $quote['total'], 2);
        $timeoutHours = self::unpaidTimeoutHours($pdo);
        $reservationExpires = date('Y-m-d H:i:s', strtotime("+{$timeoutHours} hours"));

        $pdo->beginTransaction();
        try {
            $orderStmt = $pdo->prepare(
                'INSERT INTO orders
                    (user_id, address_id, status, subtotal, intl_shipping_cost, local_delivery_cost,
                     local_delivery_percent, total, payment_status, payment_method, notes,
                     storefront_shop_id, shop_payment_method, payment_collector, payment_reservation_expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $initialPaymentStatus = 'pending';
            $orderStmt->execute([
                $userId,
                $addressId,
                'placed',
                $quote['subtotal'],
                $quote['intl_shipping_cost'],
                $quote['local_delivery_cost'],
                $quote['local_delivery_percent'],
                $total,
                $initialPaymentStatus,
                $paymentMethod === 'paystack' ? null : $paymentMethod,
                $notes !== null && trim($notes) !== '' ? trim($notes) : null,
                (int) $shop['id'],
                $paymentMethod,
                'shop',
                $paymentMethod === 'paystack' ? null : $reservationExpires,
            ]);
            $orderId = (int) $pdo->lastInsertId();

            $itemStmt = $pdo->prepare(
                'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost, unit_cbm_cost, is_preorder, estimated_arrival)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($quote['lines'] as $line) {
                $product = $line['product'];
                $itemStmt->execute([
                    $orderId,
                    (int) $product['id'],
                    (int) $line['quantity'],
                    $line['unit_price'],
                    (float) ($product['cost_price'] ?? 0),
                    0,
                    $line['is_preorder'] ? 1 : 0,
                    $line['estimated_arrival'],
                ]);
            }

            $trackNote = match ($paymentMethod) {
                'paystack'  => 'Order placed — complete online payment to the shop.',
                'momo'      => 'Order placed — pay the shop MoMo number and wait for confirmation.',
                default     => 'Order placed — pay the shop in person. Seller will confirm payment.',
            };
            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'placed', ?, ?)"
            )->execute([$orderId, $trackNote, $userId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        ShopFulfillmentService::createForOrder($pdo, $orderId, $quote['lines'], $fulfillmentMode);

        if ($paymentMethod !== 'paystack') {
            ShopFulfillmentService::notifyAwaitingPayment($pdo, (int) $shop['id'], $orderId);
        }

        NotificationService::notifyOrderStatus(
            $pdo,
            $orderId,
            'placed',
            $paymentMethod === 'paystack'
                ? 'Complete online payment to confirm your order with ' . ($shop['name'] ?? 'the shop') . '.'
                : 'Your order was placed with ' . ($shop['name'] ?? 'the shop') . '. Pay as instructed — the shop will confirm.'
        );

        $out = [
            'order_id'                 => $orderId,
            'total'                    => $total,
            'currency'                 => 'GHS',
            'payment_method'           => $paymentMethod,
            'requires_online_payment'  => $paymentMethod === 'paystack',
            'reservation_expires_at'   => $paymentMethod === 'paystack' ? null : $reservationExpires,
        ];
        if ($paymentMethod === 'momo') {
            $out['momo_number'] = $shop['momo_number'];
        }

        return $out;
    }

    public static function markPaidByShop(PDO $pdo, int $shopId, int $fulfillmentId, int $userId): void
    {
        $stmt = $pdo->prepare(
            'SELECT f.*, o.id AS order_id, o.payment_status, o.payment_collector
             FROM shop_order_fulfillments f
             INNER JOIN orders o ON o.id = f.order_id
             WHERE f.id = ? AND f.shop_id = ? LIMIT 1'
        );
        $stmt->execute([$fulfillmentId, $shopId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new RuntimeException('Order not found.');
        }
        if (($row['status'] ?? '') !== 'awaiting_payment') {
            throw new RuntimeException('This order is not awaiting payment.');
        }
        if (($row['payment_collector'] ?? '') !== 'shop') {
            throw new RuntimeException('This order uses platform payment.');
        }

        $orderId = (int) $row['order_id'];

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "UPDATE orders SET payment_status = 'paid', status = 'pending', payment_reservation_expires_at = NULL WHERE id = ?"
            )->execute([$orderId]);

            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, 'payment_confirmed', ?, ?)"
            )->execute([$orderId, 'Shop confirmed payment received.', $userId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        ShopFulfillmentService::markPaidForOrder($pdo, $orderId);
        InventoryService::commitOrderInventory($pdo, $orderId);

        $customerStmt = $pdo->prepare(
            'SELECT o.user_id, o.total, o.payment_status, o.payment_method, o.payment_ref,
                    u.email, u.name
             FROM orders o INNER JOIN users u ON u.id = o.user_id WHERE o.id = ?'
        );
        $customerStmt->execute([$orderId]);
        $customer = $customerStmt->fetch();
        if ($customer !== false) {
            $customerId = (int) $customer['user_id'];
            $itemsStmt = $pdo->prepare(
                'SELECT oi.quantity, oi.unit_price, p.name, p.images
                 FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = ? ORDER BY oi.id ASC'
            );
            $itemsStmt->execute([$orderId]);
            $items = $itemsStmt->fetchAll();
            $orderRow = [
                'id'             => $orderId,
                'total'          => (float) $customer['total'],
                'payment_status' => (string) $customer['payment_status'],
                'payment_method' => (string) ($customer['payment_method'] ?? ''),
                'payment_ref'    => $customer['payment_ref'] ?? null,
            ];
            if (trim((string) $customer['email']) !== '') {
                Mailer::orderConfirmation((string) $customer['email'], (string) $customer['name'], [
                    'order' => $orderRow,
                    'items' => $items,
                ]);
            }
            NotificationService::notifyUser(
                $pdo,
                $customerId,
                'Payment confirmed — order #' . $orderId,
                'The shop confirmed your payment. They will prepare your order soon.',
                '/dashboard/orders/' . $orderId,
                'order_update',
                false
            );
        }
    }

    /** Cancel unpaid storefront orders past reservation timeout. */
    public static function cancelExpiredUnpaid(PDO $pdo): int
    {
        $stmt = $pdo->query(
            "SELECT o.id FROM orders o
             INNER JOIN shop_order_fulfillments f ON f.order_id = o.id
             WHERE o.payment_collector = 'shop'
               AND o.payment_status = 'pending'
               AND f.status = 'awaiting_payment'
               AND o.payment_reservation_expires_at IS NOT NULL
               AND o.payment_reservation_expires_at < NOW()"
        );
        $count = 0;
        foreach ($stmt->fetchAll() as $row) {
            $orderId = (int) $row['id'];
            $pdo->prepare(
                "UPDATE orders SET payment_status = 'failed', status = 'cancelled' WHERE id = ?"
            )->execute([$orderId]);
            ShopFulfillmentService::markCancelledForOrder($pdo, $orderId);
            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'cancelled', ?)"
            )->execute([$orderId, 'Unpaid order expired — stock released.']);
            NotificationService::notifyOrderStatus(
                $pdo,
                $orderId,
                'cancelled',
                'Your unpaid shop order expired and was cancelled. Stock was released.'
            );
            $count++;
        }

        return $count;
    }
}
