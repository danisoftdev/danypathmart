<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PromoterWalletService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_promoters', 'manage_marketplace', 'edit_company_settings']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Withdrawal not found.', 404);
}

$body = Response::body();
$action = trim((string) ($body['action'] ?? ''));
$note = trim((string) ($body['admin_note'] ?? ''));
$pdo = Database::pdo();

try {
    if ($action === 'approve' || $action === 'paid') {
        PromoterWalletService::approveWithdrawal($pdo, $id, (int) $user['id'], $note !== '' ? $note : null);
    } elseif ($action === 'reject') {
        PromoterWalletService::rejectWithdrawal($pdo, $id, (int) $user['id'], $note !== '' ? $note : null);
    } else {
        Response::error('Invalid action.', 422);
    }
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not process withdrawal.', 500);
}

Response::success(['message' => 'Withdrawal updated.', 'withdrawal' => PromoterWalletService::findWithdrawal($pdo, $id)]);
