<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\ShopWalletService;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_marketplace', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Withdrawal not found.', 404);
}

$pdo = Database::pdo();
$body = Response::body();
$action = trim((string) ($body['action'] ?? 'approve'));
$note = trim((string) ($body['admin_note'] ?? ''));

try {
    if ($action === 'reject') {
        ShopWalletService::rejectWithdrawal($pdo, $id, (int) $user['id'], $note !== '' ? $note : null);
        Response::success(['message' => 'Withdrawal rejected.', 'id' => $id]);
    }
    ShopWalletService::approveWithdrawal($pdo, $id, (int) $user['id'], $note !== '' ? $note : null);
    Response::success(['message' => 'Withdrawal marked paid.', 'id' => $id]);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}
