<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Digital proof workflow for custom badge / embroidered items. */
final class CustomProofService
{
    /**
     * @param array<int,array<string,mixed>> $customizations
     */
    public static function attachToOrder(PDO $pdo, int $orderId, array $customizations): void
    {
        if ($customizations === []) {
            return;
        }

        $itemMap = [];
        $stmt = $pdo->prepare('SELECT id, product_id FROM order_items WHERE order_id = ?');
        $stmt->execute([$orderId]);
        foreach ($stmt->fetchAll() as $row) {
            $pid = (int) $row['product_id'];
            $itemMap[$pid][] = (int) $row['id'];
        }

        $insert = $pdo->prepare(
            'INSERT INTO order_customizations
                (order_id, order_item_id, product_id, file_path, label_text, instructions, status)
             VALUES (?, ?, ?, ?, ?, ?, \'pending\')'
        );

        foreach ($customizations as $row) {
            $pid = (int) ($row['product_id'] ?? 0);
            if ($pid <= 0) {
                continue;
            }
            $filePath = trim((string) ($row['file_path'] ?? ''));
            $labelText = trim((string) ($row['label_text'] ?? ''));
            $instructions = trim((string) ($row['instructions'] ?? ''));
            if ($filePath === '' && $labelText === '' && $instructions === '') {
                continue;
            }

            $itemId = null;
            if (isset($itemMap[$pid]) && $itemMap[$pid] !== []) {
                $itemId = array_shift($itemMap[$pid]);
            }

            $insert->execute([
                $orderId,
                $itemId,
                $pid,
                $filePath !== '' ? $filePath : null,
                $labelText !== '' ? $labelText : null,
                $instructions !== '' ? $instructions : null,
            ]);
        }

        NotificationService::notifyAdmins(
            $pdo,
            'Custom proof pending review',
            'Order #' . $orderId . ' includes artwork awaiting approval.',
            '/admin/custom-proofs?order_id=' . $orderId,
            'admin_alert'
        );
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listForAdmin(PDO $pdo, ?string $status = null, ?int $orderId = null): array
    {
        $where = ['1=1'];
        $params = [];
        if ($status !== null && $status !== '') {
            $where[] = 'c.status = ?';
            $params[] = $status;
        }
        if ($orderId !== null && $orderId > 0) {
            $where[] = 'c.order_id = ?';
            $params[] = $orderId;
        }

        $sql = 'SELECT c.*, p.name AS product_name, u.name AS customer_name, u.email AS customer_email
                FROM order_customizations c
                JOIN products p ON p.id = c.product_id
                JOIN orders o ON o.id = c.order_id
                JOIN users u ON u.id = o.user_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY c.created_at DESC
                LIMIT 200';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => self::formatRow($r), $stmt->fetchAll());
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function review(PDO $pdo, int $id, int $adminId, array $payload): array
    {
        $stmt = $pdo->prepare('SELECT * FROM order_customizations WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error('Proof not found.', 404);
        }

        $status = trim((string) ($payload['status'] ?? ''));
        if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
            Response::error('Invalid status.', 422);
        }

        $note = trim((string) ($payload['admin_note'] ?? ''));

        $pdo->prepare(
            'UPDATE order_customizations SET status = ?, admin_note = ?, reviewed_by = ? WHERE id = ?'
        )->execute([
            $status,
            $note !== '' ? $note : null,
            $adminId,
            $id,
        ]);

        $orderStmt = $pdo->prepare('SELECT user_id FROM orders WHERE id = ?');
        $orderStmt->execute([(int) $row['order_id']]);
        $userId = (int) $orderStmt->fetchColumn();

        if ($userId > 0 && $status !== 'pending') {
            $title = $status === 'approved'
                ? 'Custom proof approved — order #' . $row['order_id']
                : 'Custom proof needs changes — order #' . $row['order_id'];
            $body = $status === 'approved'
                ? 'Your artwork is approved. We will start production.'
                : ($note !== '' ? $note : 'Please contact us or upload revised artwork.');

            NotificationService::notifyUser(
                $pdo,
                $userId,
                $title,
                $body,
                '/dashboard/orders/' . $row['order_id'],
                'order_update'
            );
        }

        $stmt->execute([$id]);
        $updated = $stmt->fetch();

        return self::formatRow($updated !== false ? $updated : $row);
    }

    /**
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    private static function formatRow(array $r): array
    {
        return [
            'id'             => (int) $r['id'],
            'order_id'       => (int) $r['order_id'],
            'order_item_id'  => isset($r['order_item_id']) && $r['order_item_id'] !== null
                ? (int) $r['order_item_id'] : null,
            'product_id'     => (int) $r['product_id'],
            'product_name'   => $r['product_name'] ?? null,
            'customer_name'  => $r['customer_name'] ?? null,
            'customer_email' => $r['customer_email'] ?? null,
            'file_path'      => $r['file_path'] ?? null,
            'label_text'     => $r['label_text'] ?? null,
            'instructions'   => $r['instructions'] ?? null,
            'status'         => $r['status'],
            'admin_note'     => $r['admin_note'] ?? null,
            'created_at'     => $r['created_at'],
            'updated_at'     => $r['updated_at'] ?? null,
        ];
    }
}
