<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/**
 * Order lifecycle transitions shared by the Paystack webhook and the
 * development confirmation endpoint.
 */
final class OrderService
{
    /**
     * Mark an order as paid (idempotent), record the payment, advance tracking,
     * and email the customer a branded confirmation.
     *
     * @param array<string,mixed> $payload  Raw gateway payload to persist.
     */
    public static function markPaid(
        PDO $pdo,
        int $orderId,
        string $reference,
        ?string $channel = null,
        array $payload = []
    ): bool {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            return false;
        }
        if ($order['payment_status'] === 'paid') {
            return true; // already processed
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "UPDATE orders
                 SET payment_status = 'paid', status = 'processing', payment_ref = ?
                 WHERE id = ?"
            )->execute([$reference, $orderId]);

            $upd = $pdo->prepare(
                "UPDATE payments SET status = 'success', channel = ?, payload = ?
                 WHERE paystack_ref = ?"
            );
            $upd->execute([$channel, json_encode($payload), $reference]);
            if ($upd->rowCount() === 0) {
                $pdo->prepare(
                    "INSERT INTO payments (order_id, paystack_ref, amount, channel, status, payload)
                     VALUES (?, ?, ?, ?, 'success', ?)"
                )->execute([$orderId, $reference, (float) $order['total'], $channel, json_encode($payload)]);
            }

            $pdo->prepare(
                "INSERT INTO order_tracking (order_id, status, note) VALUES (?, 'payment_confirmed', ?)"
            )->execute([$orderId, 'Payment confirmed via Paystack.']);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        self::sendConfirmation($pdo, (int) $order['id'], (int) $order['user_id']);
        return true;
    }

    private static function sendConfirmation(PDO $pdo, int $orderId, int $userId): void
    {
        $orderStmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $orderStmt->execute([$orderId]);
        $order = $orderStmt->fetch();
        if ($order === false) {
            return;
        }

        $userStmt = $pdo->prepare('SELECT name, email FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            return;
        }

        $itemsStmt = $pdo->prepare(
            'SELECT oi.quantity, oi.unit_price, oi.is_preorder, oi.estimated_arrival, p.name
             FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? ORDER BY oi.id ASC'
        );
        $itemsStmt->execute([$orderId]);
        $items = $itemsStmt->fetchAll();

        Mailer::orderConfirmation((string) $user['email'], (string) $user['name'], [
            'order' => $order,
            'items' => $items,
        ]);
    }
}
