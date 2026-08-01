<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

use App\Helpers\Response;

/**
 * Soft account deletion: pending for 14 days (restored on login), then hard-deleted
 * so email / username can be registered again.
 */
final class AccountDeletionService
{
    public const RETENTION_DAYS = 14;

    public const REASONS = [
        'not_using'      => 'I no longer use DanyPathMart',
        'privacy'        => 'Privacy concerns',
        'too_many_emails'=> 'Too many emails / notifications',
        'duplicate'      => 'I have another account',
        'other'          => 'Other',
    ];

    /**
     * @return array{ok:bool,message:string}
     */
    public static function request(PDO $pdo, int $userId, string $reasonKey, ?string $detail = null): array
    {
        $reasonKey = strtolower(trim($reasonKey));
        if (!isset(self::REASONS[$reasonKey])) {
            return ['ok' => false, 'message' => 'Please select a reason.'];
        }
        $detail = $detail !== null ? trim($detail) : '';
        if ($reasonKey === 'other' && $detail === '') {
            return ['ok' => false, 'message' => 'Please write a short reason.'];
        }
        if (mb_strlen($detail) > 500) {
            return ['ok' => false, 'message' => 'Reason is too long (max 500 characters).'];
        }

        $stmt = $pdo->prepare('SELECT id, role, status FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if ($user === false) {
            return ['ok' => false, 'message' => 'Account not found.'];
        }
        if (in_array((string) $user['role'], ['super_admin', 'staff'], true)) {
            return ['ok' => false, 'message' => 'Staff accounts cannot be self-deleted. Contact an admin.'];
        }
        if (($user['status'] ?? '') === 'pending_deletion') {
            return ['ok' => true, 'message' => 'Deletion already requested. Sign in within 14 days to cancel.'];
        }

        try {
            $pdo->prepare(
                "UPDATE users SET status = 'pending_deletion', deletion_requested_at = NOW(),
                 deletion_reason = ?, deletion_reason_detail = ? WHERE id = ?"
            )->execute([$reasonKey, $detail !== '' ? $detail : null, $userId]);
        } catch (\Throwable) {
            // Column/enum may be missing until migration 066 — disable immediately then hard-delete.
            $pdo->prepare("UPDATE users SET status = 'disabled' WHERE id = ?")->execute([$userId]);
            self::hardDeleteUser($pdo, $userId);

            return [
                'ok'      => true,
                'message' => 'Account deleted. You can register again with the same email or username.',
            ];
        }

        $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);

        return [
            'ok'      => true,
            'message' => 'Account scheduled for deletion. Sign in within '
                . self::RETENTION_DAYS . ' days to restore it. After that it is permanently removed '
                . 'and you may register again with the same email or username.',
        ];
    }

    /**
     * Call on every password / OAuth / 2FA login. Restores within 14 days or purges and denies.
     *
     * @param array<string,mixed> $user
     * @return array{restored:bool}
     */
    public static function gateLogin(PDO $pdo, array &$user): array
    {
        if (($user['status'] ?? '') !== 'pending_deletion') {
            return ['restored' => false];
        }

        if (self::restoreOrPurgeOnLogin($pdo, $user)) {
            return ['restored' => true];
        }

        Response::error(
            'This account was permanently deleted after the '
            . self::RETENTION_DAYS . '-day recovery window. You can create a new account with the same email.',
            403,
            ['code' => 'account_deleted']
        );
    }

    /**
     * If account is pending deletion within the window, restore it. Returns true if restored.
     * If past the window, hard-delete and return false (caller should deny login).
     */
    public static function restoreOrPurgeOnLogin(PDO $pdo, array &$user): bool
    {
        if (($user['status'] ?? '') !== 'pending_deletion') {
            return false;
        }

        $requested = $user['deletion_requested_at'] ?? null;
        if ($requested === null) {
            $stmt = $pdo->prepare('SELECT deletion_requested_at FROM users WHERE id = ?');
            $stmt->execute([(int) $user['id']]);
            $requested = $stmt->fetchColumn() ?: null;
        }

        $deadline = $requested
            ? strtotime((string) $requested . ' +' . self::RETENTION_DAYS . ' days')
            : false;

        if ($deadline !== false && time() <= $deadline) {
            $pdo->prepare(
                "UPDATE users SET status = 'verified', deletion_requested_at = NULL,
                 deletion_reason = NULL, deletion_reason_detail = NULL WHERE id = ?"
            )->execute([(int) $user['id']]);
            $user['status'] = 'verified';

            return true;
        }

        self::hardDeleteUser($pdo, (int) $user['id']);

        return false;
    }

    public static function purgeExpired(PDO $pdo): int
    {
        try {
            $stmt = $pdo->query(
                "SELECT id FROM users
                 WHERE status = 'pending_deletion'
                   AND deletion_requested_at IS NOT NULL
                   AND deletion_requested_at < (NOW() - INTERVAL " . self::RETENTION_DAYS . ' DAY)'
            );
        } catch (\Throwable) {
            return 0;
        }

        $count = 0;
        foreach ($stmt->fetchAll() as $row) {
            if (self::hardDeleteUser($pdo, (int) $row['id'])) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Permanently remove the user row so email/username can be reused.
     * Falls back to anonymize if a foreign key blocks hard delete.
     */
    public static function hardDeleteUser(PDO $pdo, int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        // Best-effort detach of common non-cascade / restrict refs before DELETE.
        $nulls = [
            'UPDATE delivery_runs SET driver_user_id = NULL WHERE driver_user_id = ?',
            'UPDATE station_repack_batches SET created_by = NULL WHERE created_by = ?',
            'UPDATE support_conversations SET assigned_to = NULL WHERE assigned_to = ?',
            'UPDATE shop_applications SET reviewed_by = NULL WHERE reviewed_by = ?',
            'UPDATE shop_applications SET user_id = NULL WHERE user_id = ?',
            'UPDATE shop_invites SET created_by = NULL WHERE created_by = ?',
            'UPDATE promoters SET approved_by = NULL WHERE approved_by = ?',
            'UPDATE promoter_applications SET created_user_id = NULL WHERE created_user_id = ?',
            'UPDATE promoter_applications SET reviewed_by = NULL WHERE reviewed_by = ?',
            'UPDATE leave_requests SET reviewed_by = NULL WHERE reviewed_by = ?',
            'UPDATE job_applications SET reviewed_by = NULL WHERE reviewed_by = ?',
            'UPDATE contact_messages SET assigned_to = NULL WHERE assigned_to = ?',
        ];
        foreach ($nulls as $sql) {
            try {
                $pdo->prepare($sql)->execute([$userId]);
            } catch (\Throwable) {
            }
        }

        // Child rows that sometimes lack ON DELETE CASCADE on older production DBs.
        $deletes = [
            'DELETE FROM user_sessions WHERE user_id = ?',
            'DELETE FROM push_subscriptions WHERE user_id = ?',
            'DELETE FROM user_notifications WHERE user_id = ?',
            'DELETE FROM email_verifications WHERE user_id = ?',
            'DELETE FROM totp_temp_tokens WHERE user_id = ?',
            'DELETE FROM oauth_identities WHERE user_id = ?',
            'DELETE FROM webauthn_credentials WHERE user_id = ?',
            'DELETE FROM wishlist_items WHERE user_id = ?',
            'DELETE FROM shop_members WHERE user_id = ?',
            'DELETE FROM employees WHERE user_id = ?',
            'DELETE FROM promoter_withdrawals WHERE promoter_id IN (SELECT id FROM promoters WHERE user_id = ?)',
            'DELETE FROM promoter_wallet_transactions WHERE promoter_id IN (SELECT id FROM promoters WHERE user_id = ?)',
            'DELETE FROM promoter_wallets WHERE promoter_id IN (SELECT id FROM promoters WHERE user_id = ?)',
            'UPDATE subscription_referrals SET referrer_promoter_id = NULL WHERE referrer_promoter_id IN (SELECT id FROM promoters WHERE user_id = ?)',
            'UPDATE promoter_applications SET promoter_id = NULL WHERE promoter_id IN (SELECT id FROM promoters WHERE user_id = ?)',
            'DELETE FROM promoters WHERE user_id = ?',
        ];
        foreach ($deletes as $sql) {
            try {
                $pdo->prepare($sql)->execute([$userId]);
            } catch (\Throwable) {
            }
        }

        try {
            $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            if ($stmt->rowCount() > 0) {
                return true;
            }
            // Already gone (or never existed) — treat as success.
            $check = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
            $check->execute([$userId]);

            return $check->fetch() === false;
        } catch (\Throwable $e) {
            error_log('hardDeleteUser fallback anonymize #' . $userId . ': ' . $e->getMessage());
            // Ensure promoter profiles never remain visible after a failed hard delete.
            try {
                $pdo->prepare('DELETE FROM promoters WHERE user_id = ?')->execute([$userId]);
            } catch (\Throwable) {
            }
            self::anonymizeUser($pdo, $userId);

            return true;
        }
    }

    /** Last-resort: free email/username without removing the row. */
    private static function anonymizeUser(PDO $pdo, int $userId): void
    {
        $email = 'deleted_' . $userId . '_' . bin2hex(random_bytes(4)) . '@deleted.local';
        $username = 'deleted_' . $userId . '_' . bin2hex(random_bytes(3));
        try {
            $pdo->prepare(
                "UPDATE users SET
                    name = 'Deleted user',
                    username = ?,
                    email = ?,
                    password_hash = NULL,
                    phone = NULL,
                    profile_photo = NULL,
                    status = 'disabled',
                    deletion_requested_at = NULL,
                    deletion_reason = NULL,
                    deletion_reason_detail = NULL,
                    totp_enabled = 0,
                    totp_secret = NULL,
                    totp_secret_pending = NULL,
                    totp_backup_codes = NULL
                 WHERE id = ?"
            )->execute([$username, $email, $userId]);
        } catch (\Throwable) {
            $pdo->prepare(
                "UPDATE users SET name = 'Deleted user', email = ?, password_hash = NULL, status = 'disabled' WHERE id = ?"
            )->execute([$email, $userId]);
        }
        try {
            $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);
        } catch (\Throwable) {
        }
        try {
            $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ?')->execute([$userId]);
        } catch (\Throwable) {
        }
    }
}
