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
     * @param array{title:string,body:string,link_url:?string,category:string,send_email:bool,send_sms?:bool,send_whatsapp?:bool} $data
     * @return array{broadcast_id:int,recipient_count:int,sms_sent:int,whatsapp_sent:int}
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
        $smsSent = 0;
        $whatsappSent = 0;
        $sendSms = !empty($data['send_sms']);
        $sendWhatsapp = !empty($data['send_whatsapp']);

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

            if ($sendSms || $sendWhatsapp) {
                $ext = NotificationChannelService::sendExternalToUser(
                    $pdo,
                    $customer['id'],
                    $data['title'],
                    $data['body'],
                    $sendSms,
                    $sendWhatsapp
                );
                if (($ext['sms']['ok'] ?? false) === true) {
                    $smsSent++;
                }
                if (($ext['whatsapp']['ok'] ?? false) === true) {
                    $whatsappSent++;
                }
            }
        }

        $pdo->prepare('UPDATE admin_broadcasts SET recipient_count = ? WHERE id = ?')
            ->execute([$count, $broadcastId]);

        return [
            'broadcast_id'    => $broadcastId,
            'recipient_count' => $count,
            'sms_sent'        => $smsSent,
            'whatsapp_sent'   => $whatsappSent,
        ];
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

        PushNotificationService::sendPushOnly($pdo, (int) $order['user_id'], $title, $body, $linkUrl);
        NotificationChannelService::sendExternalToUser($pdo, (int) $order['user_id'], $title, $body);
    }

    /**
     * Buyer notification for shop self-delivery / pickup steps — includes that shop's products + images.
     */
    public static function notifyShopFulfillmentStatus(
        PDO $pdo,
        int $orderId,
        int $shopId,
        string $status,
        ?string $note = null
    ): void {
        $stmt = $pdo->prepare(
            'SELECT o.id, o.user_id, o.total, o.payment_ref, o.payment_status,
                    u.email, u.name,
                    s.name AS shop_name, s.logo_url AS shop_logo
             FROM orders o
             INNER JOIN users u ON u.id = o.user_id
             INNER JOIN shops s ON s.id = ?
             WHERE o.id = ?'
        );
        $stmt->execute([$shopId, $orderId]);
        $order = $stmt->fetch();
        if ($order === false) {
            return;
        }

        $itemsStmt = $pdo->prepare(
            'SELECT oi.quantity, oi.unit_price, p.name, p.images
             FROM order_items oi
             INNER JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND p.shop_id = ?
             ORDER BY oi.id ASC'
        );
        $itemsStmt->execute([$orderId, $shopId]);
        $items = $itemsStmt->fetchAll();

        $trackingRef = 'DPM-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT);
        $statusLabel = self::statusLabel($status);
        $shopName = (string) ($order['shop_name'] ?? 'Shop');
        $title = "{$shopName} — {$statusLabel} (#{$orderId})";

        $itemLines = [];
        foreach ($items as $item) {
            $itemLines[] = sprintf(
                '• %s × %d',
                (string) ($item['name'] ?? 'Item'),
                (int) ($item['quantity'] ?? 1)
            );
        }
        $bodyParts = [
            self::orderNotificationBody($status, $statusLabel, $note, $trackingRef, $order, $items),
            'Shop: ' . $shopName,
        ];
        if ($itemLines !== []) {
            $bodyParts[] = "Items:\n" . implode("\n", $itemLines);
        }
        $body = implode("\n\n", $bodyParts);
        $linkUrl = '/dashboard/orders/' . $orderId;

        $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([(int) $order['user_id'], $title, $body, $linkUrl, 'order_update']);

        $email = trim((string) ($order['email'] ?? ''));
        if ($email !== '') {
            Mailer::orderStatusUpdate($email, (string) $order['name'], [
                'order'        => $order,
                'items'        => $items,
                'status'       => $status,
                'status_label' => $shopName . ' — ' . $statusLabel,
                'note'         => $note,
                'tracking_ref' => $trackingRef,
            ]);
        }

        PushNotificationService::sendPushOnly($pdo, (int) $order['user_id'], $title, $body, $linkUrl);
        NotificationChannelService::sendExternalToUser($pdo, (int) $order['user_id'], $title, $body);
    }

    /**
     * Notify shop owners that a product listing was approved or rejected.
     *
     * @param array{id:int,name:string,shop_id:int,slug?:string} $product
     */
    public static function notifyProductListingDecision(
        PDO $pdo,
        array $product,
        string $action,
        ?string $note = null
    ): void {
        $shopId = (int) ($product['shop_id'] ?? 0);
        $productId = (int) ($product['id'] ?? 0);
        $name = trim((string) ($product['name'] ?? 'Product'));
        if ($shopId <= 0 || $productId <= 0) {
            return;
        }

        $approved = $action === 'approve' || $action === 'approved';
        $title = $approved
            ? "Product approved — {$name}"
            : "Product needs changes — {$name}";
        $body = $approved
            ? "\"{$name}\" is live on your shop storefront."
            : ("\"{$name}\" was not approved."
                . ($note !== null && trim($note) !== '' ? "\n\nNote: " . trim($note) : '')
                . "\n\nEdit and resubmit from Seller → Products.");
        $link = '/seller/products';

        $members = $pdo->prepare(
            'SELECT u.id FROM shop_members sm INNER JOIN users u ON u.id = sm.user_id WHERE sm.shop_id = ?'
        );
        $members->execute([$shopId]);
        foreach ($members->fetchAll() as $m) {
            self::notifyUser($pdo, (int) $m['id'], $title, $body, $link, 'shop_listing');
        }
    }

    /**
     * Alert staff who can review marketplace product listings.
     *
     * @param array{id:int,name:string,shop_id:int,price?:float} $product
     */
    public static function notifyNewProductListingPending(PDO $pdo, array $product, string $shopName = ''): void
    {
        $name = trim((string) ($product['name'] ?? 'Product'));
        $id = (int) ($product['id'] ?? 0);
        $price = isset($product['price']) ? (float) $product['price'] : null;
        $shopLabel = $shopName !== '' ? $shopName : ('Shop #' . (int) ($product['shop_id'] ?? 0));

        $title = "New product listing — {$name}";
        $body = "{$shopLabel} submitted \"{$name}\" for review."
            . ($price !== null ? "\nPrice: GHS " . number_format($price, 2) : '')
            . "\nReview in Admin → Marketplace → Listings.";
        $link = '/admin/marketplace';

        self::notifyStaffWithPermission(
            $pdo,
            ['approve_shop_listings', 'manage_marketplace', 'add_edit_products'],
            $title,
            $body,
            $link,
            'admin_listing'
        );
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            'placed'             => 'Order placed',
            'payment_confirmed'  => 'Payment confirmed',
            'pending'            => 'Awaiting preparation',
            'processing'         => 'Processing',
            'preparing'          => 'Preparing your items',
            'shipped'            => 'Shipped',
            'out_for_delivery'   => 'Out for delivery',
            'delivered'          => 'Delivered',
            'received_at_hub'    => 'Received at DPM hub',
            'sent_to_station'    => 'Sent to pickup station',
            'ready_for_pickup'   => 'Ready for pickup',
            'collected'          => 'Collected',
            'cancelled'          => 'Cancelled',
            'awaiting_payment'   => 'Awaiting payment',
            default              => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    /** In-app + email (+ push/SMS/WhatsApp when enabled) for any active user. */
    public static function notifyUser(
        PDO $pdo,
        int $userId,
        string $title,
        string $body,
        ?string $linkUrl,
        string $category = 'system',
        bool $sendEmail = true,
        bool $sendPush = true,
        bool $sendSms = true,
        bool $sendWhatsapp = true,
        ?callable $emailFn = null
    ): void {
        $userStmt = $pdo->prepare(
            "SELECT name, email FROM users WHERE id = ? AND status != 'disabled' LIMIT 1"
        );
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            return;
        }

        $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([$userId, $title, $body, $linkUrl, $category]);

        $email = trim((string) ($user['email'] ?? ''));
        if ($sendEmail && $email !== '') {
            if ($emailFn !== null) {
                $emailFn($email, (string) ($user['name'] ?? ''));
            } else {
                Mailer::customerNotification(
                    $email,
                    (string) $user['name'],
                    $title,
                    $body,
                    $linkUrl
                );
            }
        }

        if ($sendPush) {
            PushNotificationService::sendPushOnly($pdo, $userId, $title, $body, $linkUrl);
        }

        if ($sendSms || $sendWhatsapp) {
            NotificationChannelService::sendExternalToUser(
                $pdo,
                $userId,
                $title,
                $body,
                $sendSms,
                $sendWhatsapp
            );
        }
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
            PushNotificationService::sendPushOnly($pdo, (int) $admin['id'], $title, $body, $linkUrl);
            NotificationChannelService::sendExternalToUser(
                $pdo,
                (int) $admin['id'],
                $title,
                $body,
                true,
                true
            );
        }

        Env::load();
        $adminEmail = trim((string) Env::get('ADMIN_EMAIL', ''));
        if ($adminEmail !== '') {
            Mailer::adminAlert($adminEmail, $title, $body, $linkUrl);
        }
    }

    /**
     * Staff / super_admins who hold any of the given permissions (super_admin = all).
     *
     * @param list<string> $permissions
     * @return array<int,array{id:int,email:string,name:string,role:string}>
     */
    public static function staffWithAnyPermission(PDO $pdo, array $permissions): array
    {
        $rows = $pdo->query(
            "SELECT id, email, name, role FROM users
             WHERE role IN ('super_admin', 'staff') AND status != 'disabled'"
        )->fetchAll();

        $out = [];
        foreach ($rows as $r) {
            $id = (int) $r['id'];
            $role = (string) $r['role'];
            if (!StaffPermission::userHasAny($id, $role, $permissions)) {
                continue;
            }
            $out[] = [
                'id'    => $id,
                'email' => trim((string) ($r['email'] ?? '')),
                'name'  => (string) ($r['name'] ?? ''),
                'role'  => $role,
            ];
        }

        return $out;
    }

    /**
     * In-app + email for staff with permission; also emails company + ADMIN_EMAIL once.
     *
     * @param list<string> $permissions
     * @param callable(string $toEmail):void|null $emailFn  Custom mailer per recipient; default adminAlert
     * @param list<string> $extraEmails  e.g. company settings email
     */
    public static function notifyStaffWithPermission(
        PDO $pdo,
        array $permissions,
        string $title,
        string $body,
        ?string $linkUrl,
        string $category = 'admin_alert',
        ?callable $emailFn = null,
        array $extraEmails = []
    ): void {
        $staff = self::staffWithAnyPermission($pdo, $permissions);

        $insert = $pdo->prepare(
            'INSERT INTO user_notifications (user_id, title, body, link_url, category)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($staff as $member) {
            $insert->execute([(int) $member['id'], $title, $body, $linkUrl, $category]);
            PushNotificationService::sendPushOnly($pdo, (int) $member['id'], $title, $body, $linkUrl);
            NotificationChannelService::sendExternalToUser(
                $pdo,
                (int) $member['id'],
                $title,
                $body,
                true,
                true
            );
        }

        $send = $emailFn ?? static function (string $toEmail) use ($title, $body, $linkUrl): void {
            Mailer::adminAlert($toEmail, $title, $body, $linkUrl);
        };

        $sent = [];
        foreach ($staff as $member) {
            $email = strtolower(trim($member['email']));
            if ($email === '' || isset($sent[$email])) {
                continue;
            }
            $send($email);
            $sent[$email] = true;
        }

        Env::load();
        $extras = array_merge($extraEmails, [trim((string) Env::get('ADMIN_EMAIL', ''))]);
        foreach ($extras as $extra) {
            $email = strtolower(trim((string) $extra));
            if ($email === '' || isset($sent[$email])) {
                continue;
            }
            $send($email);
            $sent[$email] = true;
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
