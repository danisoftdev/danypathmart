<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/** Quote / proforma workflow for clubs, schools, and institutional buyers. */
final class QuoteService
{
    /**
     * @return array{quotes_enabled:bool,institutional_pay_later_enabled:bool}
     */
    public static function featureFlags(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT quotes_enabled, institutional_pay_later_enabled
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return ['quotes_enabled' => true, 'institutional_pay_later_enabled' => true];
        }

        if ($row === false) {
            return ['quotes_enabled' => true, 'institutional_pay_later_enabled' => true];
        }

        return [
            'quotes_enabled'                  => (int) ($row['quotes_enabled'] ?? 1) === 1,
            'institutional_pay_later_enabled' => (int) ($row['institutional_pay_later_enabled'] ?? 1) === 1,
        ];
    }

    public static function assertQuotesEnabled(PDO $pdo): void
    {
        if (!self::featureFlags($pdo)['quotes_enabled']) {
            Response::error('Quote requests are not available right now.', 403, ['code' => 'quotes_disabled']);
        }
    }

    public static function assertPayLaterEnabled(PDO $pdo): void
    {
        if (!self::featureFlags($pdo)['institutional_pay_later_enabled']) {
            Response::error('Institutional pay-later is not available.', 403, ['code' => 'pay_later_disabled']);
        }
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listForUser(PDO $pdo, int $userId): array
    {
        $stmt = $pdo->prepare(
            'SELECT id, quote_number, organization_name, contact_name, status, total,
                    valid_until, proforma_sent_at, converted_order_id, created_at, updated_at
             FROM quotes WHERE user_id = ?
             ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);

        return array_map(static fn (array $r): array => self::formatSummary($r), $stmt->fetchAll());
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function listAll(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT q.id, q.quote_number, q.organization_name, q.contact_name, q.contact_email,
                       q.status, q.total, q.valid_until, q.proforma_sent_at, q.converted_order_id,
                       q.created_at, q.updated_at, u.name AS user_name, u.email AS user_email
                FROM quotes q
                INNER JOIN users u ON u.id = q.user_id';
        $params = [];
        if ($status !== null && $status !== '') {
            $sql .= ' WHERE q.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY q.created_at DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static function (array $r): array {
            $s = self::formatSummary($r);
            $s['user_name'] = $r['user_name'];
            $s['user_email'] = $r['user_email'];
            return $s;
        }, $stmt->fetchAll());
    }

    /**
     * @return array<string,mixed>|null
     */
    public static function getById(PDO $pdo, int $id, ?int $userId = null, bool $withItems = true): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $sql = 'SELECT * FROM quotes WHERE id = ?';
        $params = [$id];
        if ($userId !== null) {
            $sql .= ' AND user_id = ?';
            $params[] = $userId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        return self::formatQuote($pdo, $row, $withItems);
    }

    /**
     * @param array<int,array<string,mixed>> $items
     * @return array<string,mixed>
     */
    public static function createRequest(PDO $pdo, int $userId, array $payload, array $items): array
    {
        self::assertQuotesEnabled($pdo);

        $org = trim((string) ($payload['organization_name'] ?? ''));
        $contactName = trim((string) ($payload['contact_name'] ?? ''));
        $contactEmail = trim((string) ($payload['contact_email'] ?? ''));
        $contactPhone = trim((string) ($payload['contact_phone'] ?? ''));
        $notes = trim((string) ($payload['customer_notes'] ?? ''));

        if ($org === '') {
            Response::error('Organization name is required.', 422);
        }
        if ($contactName === '') {
            Response::error('Contact name is required.', 422);
        }
        if ($contactEmail === '' || !Validator::email($contactEmail)) {
            Response::error('A valid contact email is required.', 422);
        }
        if ($items === []) {
            Response::error('Add at least one item to your quote request.', 422);
        }

        $normalized = self::normalizeItems($pdo, $items, false);
        if ($normalized === []) {
            Response::error('No valid items in quote request.', 422);
        }

        $quoteNumber = self::nextQuoteNumber($pdo);

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO quotes
                    (user_id, quote_number, organization_name, contact_name, contact_email,
                     contact_phone, customer_notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $quoteNumber,
                $org,
                $contactName,
                $contactEmail,
                $contactPhone !== '' ? $contactPhone : null,
                $notes !== '' ? $notes : null,
                'requested',
            ]);
            $quoteId = (int) $pdo->lastInsertId();

            self::insertQuoteItems($pdo, $quoteId, $normalized);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $quote = self::getById($pdo, $quoteId, $userId);
        if ($quote === null) {
            Response::error('Could not create quote.', 500);
        }

        NotificationService::notifyAdmins(
            $pdo,
            'New quote request — ' . $org,
            "Quote {$quoteNumber} from {$contactName} ({$contactEmail}).",
            '/admin/quotes/' . $quoteId,
            'admin_quote'
        );

        return $quote;
    }

    /**
     * Admin view with catalog pricing applied when proforma has not been issued yet.
     *
     * @return array<string,mixed>|null
     */
    public static function getForAdmin(PDO $pdo, int $id): ?array
    {
        $quote = self::getById($pdo, $id, null, true);
        if ($quote === null) {
            return null;
        }

        return self::attachCatalogPricing($pdo, $quote);
    }

    /**
     * Price quote lines from current product catalog + shipping settings (same as checkout).
     *
     * @param array<int,array<string,mixed>> $quoteItems
     * @return array{
     *   subtotal:float, intl_shipping_cost:float, local_delivery_cost:float,
     *   local_delivery_percent:float, total:float,
     *   unit_prices:array<int,float>, errors:array<int,array<string,mixed>>
     * }
     */
    public static function calculateCatalogPricing(PDO $pdo, array $quoteItems): array
    {
        $shipItems = [];
        foreach ($quoteItems as $item) {
            $shipItems[] = [
                'product_id' => (int) ($item['product_id'] ?? 0),
                'quantity'   => (int) ($item['quantity'] ?? 0),
            ];
        }

        $quoted = ShippingService::quote($pdo, $shipItems, false);

        $priceByProduct = [];
        foreach ($quoted['lines'] as $line) {
            $priceByProduct[(int) $line['product']['id']] = (float) $line['unit_price'];
        }

        $unitPrices = [];
        foreach ($quoteItems as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $unitPrices[(int) $item['id']] = round($priceByProduct[$pid] ?? 0.0, 2);
        }

        return [
            'subtotal'               => $quoted['subtotal'],
            'intl_shipping_cost'     => $quoted['intl_shipping_cost'],
            'local_delivery_cost'    => $quoted['local_delivery_cost'],
            'local_delivery_percent' => $quoted['local_delivery_percent'],
            'total'                  => $quoted['total'],
            'unit_prices'            => $unitPrices,
            'errors'                 => $quoted['errors'],
        ];
    }

    /**
     * @param array<string,mixed> $quote
     * @return array<string,mixed>
     */
    private static function attachCatalogPricing(PDO $pdo, array $quote): array
    {
        $useStored = in_array($quote['status'], ['proforma_sent', 'approved_pay_later', 'converted'], true)
            && (float) ($quote['total'] ?? 0) > 0;

        if ($useStored) {
            $quote['pricing_source'] = 'proforma';

            return $quote;
        }

        $pricing = self::calculateCatalogPricing($pdo, $quote['items']);
        $quote['pricing_source'] = 'catalog';
        $quote['pricing'] = [
            'subtotal'               => $pricing['subtotal'],
            'intl_shipping_cost'     => $pricing['intl_shipping_cost'],
            'local_delivery_cost'    => $pricing['local_delivery_cost'],
            'local_delivery_percent' => $pricing['local_delivery_percent'],
            'total'                  => $pricing['total'],
            'errors'                 => $pricing['errors'],
        ];

        foreach ($quote['items'] as &$item) {
            $unit = $pricing['unit_prices'][(int) $item['id']] ?? null;
            $item['unit_price'] = $unit;
            $item['line_total'] = $unit !== null
                ? round($unit * (int) $item['quantity'], 2)
                : null;
        }
        unset($item);

        $quote['subtotal'] = $pricing['subtotal'];
        $quote['intl_shipping_cost'] = $pricing['intl_shipping_cost'];
        $quote['local_delivery_cost'] = $pricing['local_delivery_cost'];
        $quote['local_delivery_percent'] = $pricing['local_delivery_percent'];
        $quote['total'] = $pricing['total'];

        return $quote;
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function sendProforma(PDO $pdo, int $quoteId, int $adminId, array $payload): array
    {
        $quote = self::getById($pdo, $quoteId, null, true);
        if ($quote === null) {
            Response::error('Quote not found.', 404);
        }
        if (!in_array($quote['status'], ['requested', 'proforma_sent'], true)) {
            Response::error('This quote cannot receive a proforma in its current state.', 422);
        }

        $pricing = self::calculateCatalogPricing($pdo, $quote['items']);
        if ($pricing['errors'] !== []) {
            Response::error('Cannot send proforma: one or more products are unavailable.', 422, [
                'errors' => $pricing['errors'],
            ]);
        }

        $priceByItemId = $pricing['unit_prices'];
        $intl = $pricing['intl_shipping_cost'];
        $local = $pricing['local_delivery_cost'];
        $localPct = $pricing['local_delivery_percent'];
        $proformaNote = trim((string) ($payload['proforma_note'] ?? ''));
        $adminNotes = trim((string) ($payload['admin_notes'] ?? ''));
        $validUntil = trim((string) ($payload['valid_until'] ?? ''));

        $subtotal = $pricing['subtotal'];
        $total = $pricing['total'];

        $pdo->beginTransaction();
        try {
            foreach ($priceByItemId as $itemId => $unitPrice) {
                $pdo->prepare('UPDATE quote_items SET unit_price = ? WHERE id = ? AND quote_id = ?')
                    ->execute([$unitPrice, $itemId, $quoteId]);
            }

            $pdo->prepare(
                'UPDATE quotes SET status = ?, subtotal = ?, intl_shipping_cost = ?,
                    local_delivery_cost = ?, local_delivery_percent = ?, total = ?,
                    proforma_note = ?, admin_notes = ?, valid_until = ?,
                    proforma_sent_at = NOW(), reviewed_by = ?
                 WHERE id = ?'
            )->execute([
                'proforma_sent',
                $subtotal,
                $intl,
                $local,
                $localPct,
                $total,
                $proformaNote !== '' ? $proformaNote : null,
                $adminNotes !== '' ? $adminNotes : null,
                $validUntil !== '' ? $validUntil : null,
                $adminId,
                $quoteId,
            ]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        try {
            NotificationService::notifyUser(
                $pdo,
                (int) $quote['user_id'],
                'Proforma ready — ' . $quote['quote_number'],
                'Your quote for ' . $quote['organization_name'] . ' is ready. Review the proforma and pay when ready.',
                '/dashboard/quotes/' . $quoteId,
                'order_update'
            );
        } catch (Throwable $notifyErr) {
            error_log('Proforma notification failed: ' . $notifyErr->getMessage());
        }

        $updated = self::getById($pdo, $quoteId, null);
        if ($updated === null) {
            Response::error('Quote updated but could not reload.', 500);
        }

        return $updated;
    }

    /**
     * @return array{quote:array<string,mixed>,order_id:int}
     */
    public static function approvePayLater(PDO $pdo, int $quoteId, int $adminId, array $payload): array
    {
        self::assertPayLaterEnabled($pdo);

        $quote = self::getById($pdo, $quoteId, null, true);
        if ($quote === null) {
            Response::error('Quote not found.', 404);
        }
        if ($quote['status'] !== 'proforma_sent') {
            Response::error('Send a proforma before approving pay-later.', 422);
        }
        if ($quote['converted_order_id'] !== null) {
            Response::error('This quote already has an order.', 422);
        }
        if ((float) $quote['total'] <= 0) {
            Response::error('Quote total must be set before approval.', 422);
        }

        PaymentSettings::assertMethodEnabled($pdo, 'bank_transfer');

        $poRef = trim((string) ($payload['po_reference'] ?? ''));
        if ($poRef === '') {
            $poRef = self::defaultPoReference($quote);
        }
        $addressId = isset($payload['address_id']) ? (int) $payload['address_id'] : null;

        $pdo->beginTransaction();
        try {
            $orderId = self::createOrderFromQuote(
                $pdo,
                $quote,
                (int) $quote['user_id'],
                'institutional',
                'bank_transfer',
                $addressId > 0 ? $addressId : null,
                $poRef,
                true
            );

            $pdo->prepare(
                "UPDATE quotes SET status = 'approved_pay_later', approved_at = NOW(),
                    converted_order_id = ?, reviewed_by = ? WHERE id = ?"
            )->execute([$orderId, $adminId, $quoteId]);

            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([
                $orderId,
                'placed',
                'Institutional order approved — invoice issued. Pay by bank transfer when ready.',
                $adminId,
            ]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        NotificationService::notifyUser(
            $pdo,
            (int) $quote['user_id'],
            'Order approved — ' . $quote['quote_number'],
            'Your institutional order is approved. Transfer ' . number_format((float) $quote['total'], 2)
            . ' GHS and submit your reference from the order page.',
            '/dashboard/orders/' . $orderId,
            'order_update'
        );

        $updated = self::getById($pdo, $quoteId, null);
        if ($updated === null) {
            Response::error('Order created but quote could not reload.', 500);
        }

        return ['quote' => $updated, 'order_id' => $orderId, 'po_reference' => $poRef];
    }

    /**
     * @return array{quote:array<string,mixed>,order_id:int,payment_method:string,total:float}
     */
    public static function convertToOrder(PDO $pdo, int $quoteId, int $userId, array $payload): array
    {
        $quote = self::getById($pdo, $quoteId, $userId, true);
        if ($quote === null) {
            Response::error('Quote not found.', 404);
        }
        if ($quote['status'] !== 'proforma_sent') {
            Response::error('This quote is not ready to pay.', 422);
        }
        if ($quote['converted_order_id'] !== null) {
            return [
                'quote'           => $quote,
                'order_id'        => (int) $quote['converted_order_id'],
                'payment_method'  => 'existing',
                'total'           => (float) $quote['total'],
                'already_converted' => true,
            ];
        }
        if ((float) $quote['total'] <= 0) {
            Response::error('Quote total is not set yet.', 422);
        }

        if ($quote['valid_until'] !== null && $quote['valid_until'] < date('Y-m-d')) {
            Response::error('This proforma has expired. Contact us for an updated quote.', 422, [
                'code' => 'quote_expired',
            ]);
        }

        $paymentMethod = trim((string) ($payload['payment_method'] ?? 'paystack'));
        $allowed = ['paystack', 'bank_transfer', 'wallet'];
        if (!in_array($paymentMethod, $allowed, true)) {
            Response::error('Invalid payment method.', 422);
        }
        PaymentSettings::assertMethodEnabled($pdo, $paymentMethod === 'wallet' ? 'wallet' : $paymentMethod);

        $addressId = isset($payload['address_id']) ? (int) $payload['address_id'] : null;
        if ($addressId !== null && $addressId > 0) {
            $chk = $pdo->prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?');
            $chk->execute([$addressId, $userId]);
            if ($chk->fetchColumn() === false) {
                Response::error('Delivery address not found.', 422);
            }
        } else {
            $addressId = null;
        }

        $orderType = $quote['status'] === 'approved_pay_later' ? 'institutional' : 'institutional';

        $pdo->beginTransaction();
        try {
            $orderId = self::createOrderFromQuote(
                $pdo,
                $quote,
                $userId,
                $orderType,
                $paymentMethod === 'paystack' ? null : $paymentMethod,
                $addressId,
                null,
                true
            );

            $pdo->prepare(
                "UPDATE quotes SET status = 'converted', converted_order_id = ? WHERE id = ?"
            )->execute([$orderId, $quoteId]);

            $trackNote = match ($paymentMethod) {
                'bank_transfer' => 'Order from proforma — complete bank transfer to confirm payment.',
                'wallet'        => 'Order from proforma — apply wallet credit to pay.',
                default         => 'Order from proforma — awaiting Paystack payment.',
            };
            $pdo->prepare(
                'INSERT INTO order_tracking (order_id, status, note, updated_by) VALUES (?, ?, ?, ?)'
            )->execute([$orderId, 'placed', $trackNote, $userId]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $updated = self::getById($pdo, $quoteId, $userId);
        if ($updated === null) {
            Response::error('Order created but quote could not reload.', 500);
        }

        return [
            'quote'          => $updated,
            'order_id'       => $orderId,
            'payment_method' => $paymentMethod,
            'total'          => (float) $quote['total'],
        ];
    }

    public static function reject(PDO $pdo, int $quoteId, int $adminId, ?string $reason): array
    {
        $quote = self::getById($pdo, $quoteId, null, false);
        if ($quote === null) {
            Response::error('Quote not found.', 404);
        }
        if (in_array($quote['status'], ['converted', 'rejected'], true)) {
            Response::error('This quote cannot be rejected.', 422);
        }

        $reason = trim((string) $reason);
        $pdo->prepare(
            "UPDATE quotes SET status = 'rejected', admin_notes = ?, reviewed_by = ? WHERE id = ?"
        )->execute([
            $reason !== '' ? $reason : ($quote['admin_notes'] ?? null),
            $adminId,
            $quoteId,
        ]);

        NotificationService::notifyUser(
            $pdo,
            (int) $quote['user_id'],
            'Quote update — ' . $quote['quote_number'],
            $reason !== '' ? $reason : 'Your quote request was not approved at this time.',
            '/dashboard/quotes/' . $quoteId,
            'order_update'
        );

        $updated = self::getById($pdo, $quoteId, null);
        if ($updated === null) {
            Response::error('Quote rejected but could not reload.', 500);
        }

        return $updated;
    }

    /**
     * @param array<int,array<string,mixed>> $items
     * @return array<int,array<string,mixed>>
     */
    private static function normalizeItems(PDO $pdo, array $items, bool $requirePrices): array
    {
        $normalized = [];
        $sort = 0;

        foreach ($items as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $qty = max(1, (int) ($item['quantity'] ?? 1));
            if ($pid <= 0) {
                continue;
            }

            $stmt = $pdo->prepare("SELECT id, name, status FROM products WHERE id = ?");
            $stmt->execute([$pid]);
            $product = $stmt->fetch();
            if ($product === false || $product['status'] !== 'active') {
                continue;
            }

            $unitPrice = null;
            if (isset($item['unit_price']) && is_numeric($item['unit_price'])) {
                $unitPrice = round((float) $item['unit_price'], 2);
            } elseif ($requirePrices) {
                Response::error('Each item needs a unit price.', 422);
            }

            $recipient = trim((string) ($item['recipient_name'] ?? ''));
            $size = trim((string) ($item['size_label'] ?? ''));

            $normalized[] = [
                'product_id'     => $pid,
                'quantity'       => $qty,
                'unit_price'     => $unitPrice,
                'recipient_name' => $recipient !== '' ? $recipient : null,
                'size_label'     => $size !== '' ? $size : null,
                'sort_order'     => $sort++,
                'product_name'   => $product['name'],
            ];
        }

        return $normalized;
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private static function insertQuoteItems(PDO $pdo, int $quoteId, array $items): void
    {
        $stmt = $pdo->prepare(
            'INSERT INTO quote_items
                (quote_id, product_id, quantity, unit_price, recipient_name, size_label, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($items as $item) {
            $stmt->execute([
                $quoteId,
                (int) $item['product_id'],
                (int) $item['quantity'],
                $item['unit_price'],
                $item['recipient_name'],
                $item['size_label'],
                (int) $item['sort_order'],
            ]);
        }
    }

    /**
     * @param array<string,mixed> $quote
     */
    private static function createOrderFromQuote(
        PDO $pdo,
        array $quote,
        int $userId,
        string $orderType,
        ?string $paymentMethod,
        ?int $addressId,
        ?string $poReference,
        bool $inTransaction
    ): int {
        if (!$inTransaction) {
            $pdo->beginTransaction();
        }

        try {
            $pdo->prepare(
                'INSERT INTO orders
                    (user_id, address_id, status, subtotal, intl_shipping_cost,
                     local_delivery_cost, local_delivery_percent, total, payment_status,
                     payment_method, notes, order_type, organization_name, quote_id, po_reference)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $addressId,
                'placed',
                (float) $quote['subtotal'],
                (float) $quote['intl_shipping_cost'],
                (float) $quote['local_delivery_cost'],
                (float) $quote['local_delivery_percent'],
                (float) $quote['total'],
                'pending',
                $paymentMethod,
                $quote['proforma_note'] ?? null,
                $orderType,
                $quote['organization_name'],
                (int) $quote['id'],
                $poReference,
            ]);
            $orderId = (int) $pdo->lastInsertId();

            $itemStmt = $pdo->prepare(
                'SELECT qi.*, p.cost_price, p.is_preorder, p.estimated_arrival_days
                 FROM quote_items qi
                 INNER JOIN products p ON p.id = qi.product_id
                 WHERE qi.quote_id = ?
                 ORDER BY qi.sort_order ASC, qi.id ASC'
            );
            $itemStmt->execute([(int) $quote['id']]);

            $insert = $pdo->prepare(
                'INSERT INTO order_items
                    (order_id, product_id, quantity, unit_price, unit_cost, unit_cbm_cost,
                     is_preorder, estimated_arrival, recipient_name, size_label)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );

            foreach ($itemStmt->fetchAll() as $row) {
                $qty = (int) $row['quantity'];
                $unitPrice = (float) $row['unit_price'];
                $isPre = (int) $row['is_preorder'] === 1;
                $eta = null;
                if ($isPre && !empty($row['estimated_arrival_days'])) {
                    $eta = date('Y-m-d', time() + ((int) $row['estimated_arrival_days']) * 86400);
                }

                $insert->execute([
                    $orderId,
                    (int) $row['product_id'],
                    $qty,
                    $unitPrice,
                    (float) ($row['cost_price'] ?? 0),
                    0.0,
                    $isPre ? 1 : 0,
                    $eta,
                    $row['recipient_name'],
                    $row['size_label'],
                ]);

                if (!$isPre) {
                    $pdo->prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?')
                        ->execute([$qty, (int) $row['product_id']]);
                }
            }

            if (!$inTransaction) {
                $pdo->commit();
            }
        } catch (Throwable $e) {
            if (!$inTransaction) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return $orderId;
    }

    /**
     * Institutional PO / invoice reference derived from the proforma quote number.
     *
     * @param array<string,mixed> $quote
     */
    private static function defaultPoReference(array $quote): string
    {
        $number = trim((string) ($quote['quote_number'] ?? ''));
        if ($number === '') {
            return 'PO-' . (int) ($quote['id'] ?? 0);
        }

        return $number;
    }

    private static function nextQuoteNumber(PDO $pdo): string
    {
        $year = date('Y');
        $prefix = 'Q' . $year . '-';
        $stmt = $pdo->prepare(
            'SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([$prefix . '%']);
        $last = $stmt->fetchColumn();
        $seq = 1;
        if ($last !== false && preg_match('/-(\d+)$/', (string) $last, $m) === 1) {
            $seq = (int) $m[1] + 1;
        }

        return $prefix . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private static function formatSummary(array $row): array
    {
        return [
            'id'                  => (int) $row['id'],
            'quote_number'        => $row['quote_number'],
            'organization_name'   => $row['organization_name'],
            'contact_name'        => $row['contact_name'],
            'status'              => $row['status'],
            'total'               => round((float) ($row['total'] ?? 0), 2),
            'valid_until'         => $row['valid_until'] ?? null,
            'proforma_sent_at'    => $row['proforma_sent_at'] ?? null,
            'converted_order_id'  => isset($row['converted_order_id']) && $row['converted_order_id'] !== null
                ? (int) $row['converted_order_id'] : null,
            'created_at'          => $row['created_at'],
            'updated_at'          => $row['updated_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private static function formatQuote(PDO $pdo, array $row, bool $withItems): array
    {
        $quote = [
            'id'                     => (int) $row['id'],
            'quote_number'           => $row['quote_number'],
            'user_id'                => (int) $row['user_id'],
            'organization_name'      => $row['organization_name'],
            'contact_name'           => $row['contact_name'],
            'contact_email'          => $row['contact_email'],
            'contact_phone'          => $row['contact_phone'],
            'status'                 => $row['status'],
            'subtotal'               => round((float) ($row['subtotal'] ?? 0), 2),
            'intl_shipping_cost'     => round((float) ($row['intl_shipping_cost'] ?? 0), 2),
            'local_delivery_cost'    => round((float) ($row['local_delivery_cost'] ?? 0), 2),
            'local_delivery_percent' => round((float) ($row['local_delivery_percent'] ?? 0), 2),
            'total'                  => round((float) ($row['total'] ?? 0), 2),
            'customer_notes'         => $row['customer_notes'],
            'admin_notes'            => $row['admin_notes'],
            'proforma_note'          => $row['proforma_note'],
            'valid_until'            => $row['valid_until'],
            'proforma_sent_at'       => $row['proforma_sent_at'],
            'approved_at'            => $row['approved_at'] ?? null,
            'converted_order_id'     => $row['converted_order_id'] !== null
                ? (int) $row['converted_order_id'] : null,
            'created_at'             => $row['created_at'],
            'updated_at'             => $row['updated_at'],
            'can_pay'                => ($row['status'] ?? '') === 'proforma_sent'
                && $row['converted_order_id'] === null,
        ];

        if (!$withItems) {
            return $quote;
        }

        $stmt = $pdo->prepare(
            'SELECT qi.id, qi.product_id, qi.quantity, qi.unit_price, qi.recipient_name, qi.size_label,
                    qi.sort_order, p.name AS product_name, p.slug AS product_slug, p.images
             FROM quote_items qi
             INNER JOIN products p ON p.id = qi.product_id
             WHERE qi.quote_id = ?
             ORDER BY qi.sort_order ASC, qi.id ASC'
        );
        $stmt->execute([(int) $row['id']]);

        $quote['items'] = array_map(static function (array $r): array {
            $images = json_decode((string) ($r['images'] ?? ''), true);
            return [
                'id'             => (int) $r['id'],
                'product_id'     => (int) $r['product_id'],
                'product_name'   => $r['product_name'],
                'product_slug'   => $r['product_slug'],
                'image'          => is_array($images) ? ($images[0] ?? null) : null,
                'quantity'       => (int) $r['quantity'],
                'unit_price'     => $r['unit_price'] !== null ? round((float) $r['unit_price'], 2) : null,
                'line_total'     => $r['unit_price'] !== null
                    ? round((float) $r['unit_price'] * (int) $r['quantity'], 2) : null,
                'recipient_name' => $r['recipient_name'],
                'size_label'     => $r['size_label'],
            ];
        }, $stmt->fetchAll());

        return $quote;
    }
}
