<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\AuthTokens;
use App\Helpers\Response;

if (Env::isProduction()) {
    Response::error('Not found.', 404);
}

$flag = strtolower(trim((string) Env::get('DEV_ADMIN_BYPASS', '0')));
if (!in_array($flag, ['1', 'true', 'yes', 'on'], true)) {
    Response::error('Dev admin bypass is disabled.', 403, ['code' => 'dev_bypass_disabled']);
}

$pdo = Database::pdo();
$email = trim((string) (Env::get('DEV_ADMIN_EMAIL') ?? Env::get('ADMIN_EMAIL') ?? ''));

if ($email !== '') {
    $stmt = $pdo->prepare(
        "SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
         FROM users WHERE email = ? AND role IN ('super_admin', 'staff') LIMIT 1"
    );
    $stmt->execute([strtolower($email)]);
    $user = $stmt->fetch();
} else {
    $user = $pdo->query(
        "SELECT id, name, username, email, phone, role, status, preferred_currency, totp_enabled, profile_photo
         FROM users WHERE role = 'super_admin' ORDER BY id ASC LIMIT 1"
    )->fetch();
}

if ($user === false) {
    Response::error('No admin account found for dev bypass. Set DEV_ADMIN_EMAIL or create a super_admin.', 404, [
        'code' => 'dev_admin_missing',
    ]);
}

if (($user['status'] ?? '') === 'disabled') {
    Response::error('Dev admin account is disabled.', 403);
}

$user['totp_enabled'] = 1;

$tokens = AuthTokens::issueFor($user);
Response::success([
    'message'    => 'Dev admin session (local only).',
    'dev_bypass' => true,
] + $tokens);
