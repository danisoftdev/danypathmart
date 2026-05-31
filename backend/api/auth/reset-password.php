<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\Validator;

$body = Response::body();
$token    = (string) ($body['token'] ?? '');
$password = (string) ($body['new_password'] ?? '');
$confirm  = (string) ($body['confirm_password'] ?? '');

if ($token === '' || strlen($token) !== 64 || ctype_xdigit($token) === false) {
    Response::error('This reset link is invalid or has expired.', 400, ['code' => 'bad_token']);
}
if (!Validator::passwordStrong($password)) {
    Response::error('Password must be at least 8 characters and include an uppercase letter and a number', 422);
}
if (!hash_equals($password, $confirm)) {
    Response::error('Passwords do not match', 422);
}

$pdo = Database::pdo();
$tokenHash = hash('sha256', $token);

$stmt = $pdo->prepare(
    "SELECT id, user_id, otp_hash, expires_at
     FROM email_verifications
     WHERE type = 'password_reset' AND expires_at > NOW()
     ORDER BY id DESC"
);
$stmt->execute();

$match = null;
foreach ($stmt->fetchAll() as $row) {
    if (hash_equals((string) $row['otp_hash'], $tokenHash)) {
        $match = $row;
        break;
    }
}

if ($match === null) {
    Response::error('This reset link is invalid or has expired.', 400, ['code' => 'bad_token']);
}

$userId = (int) $match['user_id'];
$newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$newHash, $userId]);

    // Consume the reset token and revoke all active sessions.
    $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ? AND type = 'password_reset'")
        ->execute([$userId]);
    $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

Response::success(['message' => 'Password changed. Please log in.']);
