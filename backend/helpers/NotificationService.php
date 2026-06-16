<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** In-app notifications and admin broadcasts. */
final class NotificationService
{
    /**
     * @return array<int,array{id:int,email:string,name:string}>
     */
    public static function verifiedCustomers(PDO $pdo): array
    {
        $rows = $pdo->query(
            "SELECT id, email, name FROM users
             WHERE role = 'customer' AND status = 'verified' AND email IS NOT NULL AND email != ''"
        )->fetchAll();

        return array_map(static fn (array $r): array => [
            'id'    => (int) $r['id'],
            'email' => (string) $r['email'],
            'name'  => (string) $r['name'],
        ], $rows);
    }

    /**
     * @param array{title:string,body:string,link_url:?string,category:string,send_email:bool} $data
     * @return array{broadcast_id:int,recipient_count:int}
     */
    public static function sendBroadcast(PDO $pdo, array $data, int $sentBy): array
    {
        $pdo->prepare(
            'INSERT INTO admin_broadcasts (title, body, link_url, category, send_email, sent_by)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            $data['title'],
            $data['body'],
            $data['link_url'],
            $data['category'],
            $data['send_email'] ? 1 : 0,
            $sentBy,
        ]);

        $broadcastId = (int) $pdo->lastInsertId();
        $customers = self::verifiedCustomers($pdo);
        $count = 0;

        $insert = $pdo->prepare(
            'INSERT INTO user_notifications (user_id, broadcast_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        foreach ($customers as $customer) {
            $insert->execute([
                $customer['id'],
                $broadcastId,
                $data['title'],
                $data['body'],
                $data['link_url'],
                $data['category'],
            ]);
            $count++;

            if ($data['send_email']) {
                Mailer::customerNotification(
                    $customer['email'],
                    $customer['name'],
                    $data['title'],
                    $data['body'],
                    $data['link_url']
                );
            }
        }

        $pdo->prepare('UPDATE admin_broadcasts SET recipient_count = ? WHERE id = ?')
            ->execute([$count, $broadcastId]);

        return ['broadcast_id' => $broadcastId, 'recipient_count' => $count];
    }

    public static function notifyOrderStatus(PDO $pdo, int $orderId, string $status, ?string $note): void
    {
        $stmt = $pdo->prepare(
            'SELECT o.id, o.user_id, o.status, o.payment_ref, o.total, o.subtotal,
                    o.intl_shipping_cost, o.local_delivery_cost, o.local_delivery_percent,
                    o.pickup_station_snapshot,
                    u.email, u.name
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             WHERE o.id = ?'
        );
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            return;
        }

        $itemsStmt = $pdo->prepare(
            'SELECT oi.quantity, oi.unit_price, oi.is_preorder, p.name, p.images
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?'
        );
        $itemsStmt->execute([$orderId]);
        $items = $itemsStmt->fetchAll();

        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        $statusLabel = self::statusLabel($status);
        $title = "Order {$trackingRef} — {$statusLabel}";
        $body = self::orderNotificationBody($status, $statusLabel, $note, $trackingRef, $order, $items);
        $linkUrl = '/dashboard/orders/' . $orderId;

        $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            (int) $order['user_id'],
            $title,
            $body,
            $linkUrl,
            'order_update',
        ]);

        Mailer::orderStatusUpdate(
            (string) $order['email'],
            (string) $order['name'],
            [
                'order'        => $order,
                'items'        => $items,
                'status'       => $status,
                'status_label' => $statusLabel,
                'note'         => $note,
                'tracking_ref' => $trackingRef,
            ]
        );
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            'placed'             => 'Order placed',
            'payment_confirmed'  => 'Payment confirmed',
            'pending'            => 'Awaiting preparation',
            'processing'         => 'Processing',
            'shipped'            => 'Shipped',
            'out_for_delivery'   => 'Out for delivery',
            'delivered'          => 'Delivered',
            'received_at_hub'    => 'Received at DPM hub',
            'sent_to_station'    => 'Sent to pickup station',
            'ready_for_pickup'   => 'Ready for pickup',
            'collected'          => 'Collected',
            'cancelled'          => 'Cancelled',
            default              => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    /** In-app + email notification for any customer event. */
    public static function notifyUser(
        PDO $pdo,
        int $userId,
        string $title,
        string $body,
        ?string $linkUrl,
        string $category = 'system'
    ): void {
        $userStmt = $pdo->prepare("SELECT name, email FROM users WHERE id = ? AND role = 'customer'");
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            return;
        }

        $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([$userId, $title, $body, $linkUrl, $category]);

        Mailer::customerNotification(
            (string) $user['email'],
            (string) $user['name'],
            $title,
            $body,
            $linkUrl
        );
    }

    /**
     * Email + in-app alert for every active admin/staff account.
     *
     * @return array<int,array{id:int,email:string,name:string}>
     */
    public static function adminRecipients(PDO $pdo): array
    {
        $rows = $pdo->query(
            "SELECT id, email, name FROM users
             WHERE role IN ('super_admin', 'staff') AND status != 'disabled'
               AND email IS NOT NULL AND email != ''"
        )->fetchAll();

        return array_map(static fn (array $r): array => [
            'id'    => (int) $r['id'],
            'email' => (string) $r['email'],
            'name'  => (string) $r['name'],
        ], $rows);
    }

    public static function notifyAdmins(
        PDO $pdo,
        string $title,
        string $body,
        ?string $linkUrl,
        string $category = 'admin_alert'
    ): void {
        $admins = self::adminRecipients($pdo);
        if ($admins === []) {
            return;
        }

        $insert = $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($admins as $admin) {
            $insert->execute([(int) $admin['id'], $title, $body, $linkUrl, $category]);
        }

        Env::load();
        $adminEmail = trim((string) Env::get('ADMIN_EMAIL', ''));
        if ($adminEmail !== '') {
            Mailer::adminAlert($adminEmail, $title, $body, $linkUrl);
        }
    }

    public static function notifyNewOrder(
        PDO $pdo,
        int $orderId,
        array $customer,
        float $total,
        string $paymentMethod,
        ?string $organizationName = null
    ): void {
        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        $name = (string) ($customer['name'] ?? 'Customer');
        $email = (string) ($customer['email'] ?? '');
        $orgLine = $organizationName !== null && $organizationName !== ''
            ? "\nOrganization: {$organizationName}" : '';
        $payLabel = $paymentMethod !== '' ? $paymentMethod : 'paystack';

        self::notifyAdmins(
            $pdo,
            "New order {$trackingRef}",
            "{$name} ({$email}) placed an order.\n"
            . "Total: GHS " . number_format($total, 2)
            . "\nPayment: {$payLabel}{$orgLine}",
            '/admin/orders/' . $orderId,
            'admin_order'
        );
    }

    public static function notifyOrderPaid(PDO $pdo, int $orderId, array $order, ?string $channel = null): void
    {
        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        $via = $channel !== null && $channel !== '' ? " via {$channel}" : '';

        self::notifyAdmins(
            $pdo,
            "Payment received — {$trackingRef}",
            'Order #' . $orderId . ' is paid' . $via . ' — GHS '
            . number_format((float) ($order['total'] ?? 0), 2) . '.',
            '/admin/orders/' . $orderId,
            'admin_order'
        );
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private static function orderNotificationBody(
        string $status,
        string $statusLabel,
        ?string $note,
        string $trackingRef,
        array $order,
        array $items
    ): string {
        $lines = ["Your order status is now: {$statusLabel}.", "Tracking reference: {$trackingRef}."];
        if ($status === 'ready_for_pickup') {
            $station = OrderService::pickupStationFromOrder($order);
            if ($station !== null) {
                $lines[] = 'Collect at: ' . ($station['name'] ?? 'your pickup station');
                $addr = trim(($station['street_address'] ?? '') . ', ' . ($station['city'] ?? ''));
                if ($addr !== ',') {
                    $lines[] = $addr;
                }
                if (!empty($station['hours'])) {
                    $lines[] = 'Hours: ' . $station['hours'];
                }
                $lines[] = 'Bring your order number or ID when collecting.';
            }
        }
        if ($note) {
            $lines[] = "Note: {$note}";
        }
        $names = array_filter(array_map(static fn ($i) => $i['name'] ?? null, $items));
        if ($names) {
            $lines[] = 'Items: ' . implode(', ', array_slice($names, 0, 3))
                . (count($names) > 3 ? '…' : '');
        }
        $lines[] = 'Total: GHS ' . number_format((float) $order['total'], 2);
        return implode("\n", $lines);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listForUser(PDO $pdo, int $userId, int $limit = 50): array
    {
        $stmt = $pdo->prepare(
            'SELECT id, title, body, link_url, category, is_read, created_at
             FROM user_notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ' . max(1, min($limit, 100))
        );
        $stmt->execute([$userId]);

        return array_map(static fn (array $r): array => [
            'id'         => (int) $r['id'],
            'title'      => $r['title'],
            'body'       => $r['body'],
            'link_url'   => $r['link_url'],
            'category'   => $r['category'],
            'is_read'    => (bool) $r['is_read'],
            'created_at' => $r['created_at'],
        ], $stmt->fetchAll());
    }

    public static function unreadCount(PDO $pdo, int $userId): int
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM user_notifications WHERE user_id = ? AND is_read = 0'
        );
        $stmt->execute([$userId]);

        return (int) $stmt->fetchColumn();
    }

    /**
     * @param array<int,int> $ids
     */
    public static function deleteForUser(PDO $pdo, int $userId, array $ids): int
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
        if ($ids === []) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$userId], $ids);
        $stmt = $pdo->prepare(
            "DELETE FROM user_notifications WHERE user_id = ? AND id IN ({$placeholders})"
        );
        $stmt->execute($params);

        return $stmt->rowCount();
    }

    public static function deleteOneForUser(PDO $pdo, int $userId, int $id): bool
    {
        if ($id <= 0) {
            return false;
        }

        $stmt = $pdo->prepare('DELETE FROM user_notifications WHERE user_id = ? AND id = ?');
        $stmt->execute([$userId, $id]);

        return $stmt->rowCount() > 0;
    }
}
