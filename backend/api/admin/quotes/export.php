<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CsvExportHelper;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_orders');

$pdo = Database::pdo();
$status = trim((string) ($_GET['status'] ?? ''));
$columnsParam = trim((string) ($_GET['columns'] ?? ''));

$allColumns = [
    'quote_number',
    'organization_name',
    'contact_name',
    'contact_email',
    'contact_phone',
    'status',
    'subtotal',
    'intl_shipping',
    'local_delivery',
    'total',
    'valid_until',
    'proforma_sent_at',
    'converted_order_id',
    'account_name',
    'account_email',
    'created_at',
];

$allowed = ['requested', 'proforma_sent', 'approved_pay_later', 'converted', 'rejected'];
$sql = 'SELECT q.quote_number, q.organization_name, q.contact_name, q.contact_email, q.contact_phone,
               q.status, q.subtotal, q.intl_shipping_cost, q.local_delivery_cost, q.total,
               q.valid_until, q.proforma_sent_at, q.converted_order_id, q.created_at,
               u.name AS user_name, u.email AS user_email
        FROM quotes q
        INNER JOIN users u ON u.id = q.user_id
        WHERE 1=1';
$params = [];

if ($status !== '' && in_array($status, $allowed, true)) {
    $sql .= ' AND q.status = ?';
    $params[] = $status;
}

$sql .= ' ORDER BY q.created_at DESC LIMIT 5000';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$rows = [];
foreach ($stmt->fetchAll() as $row) {
    $rows[] = [
        'quote_number'       => $row['quote_number'],
        'organization_name'  => $row['organization_name'],
        'contact_name'       => $row['contact_name'],
        'contact_email'      => $row['contact_email'],
        'contact_phone'      => $row['contact_phone'] ?? '',
        'status'             => $row['status'],
        'subtotal'           => number_format((float) $row['subtotal'], 2, '.', ''),
        'intl_shipping'      => number_format((float) $row['intl_shipping_cost'], 2, '.', ''),
        'local_delivery'     => number_format((float) $row['local_delivery_cost'], 2, '.', ''),
        'total'              => number_format((float) $row['total'], 2, '.', ''),
        'valid_until'        => $row['valid_until'] ?? '',
        'proforma_sent_at'   => $row['proforma_sent_at'] ?? '',
        'converted_order_id' => $row['converted_order_id'] ?? '',
        'account_name'       => $row['user_name'],
        'account_email'      => $row['user_email'],
        'created_at'         => $row['created_at'],
    ];
}

$columns = CsvExportHelper::resolveColumns($allColumns, $columnsParam ?: null);
$out = CsvExportHelper::beginDownload('danypathmart-quotes-' . date('Y-m-d') . '.csv');
CsvExportHelper::writeRows($out, $columns, $rows);
fclose($out);
exit;
