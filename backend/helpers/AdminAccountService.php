<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Permission-gated hard delete for customer / workforce login accounts. */
final class AdminAccountService
{
    /** @var list<string> */
    public const DELETABLE_ROLES = [
        'customer',
        'promoter',
        'driver',
        'station_staff',
        'staff',
    ];

    /**
     * @param list<string> $allowedRoles
     * @return array{id:int,name:string,email:string,role:string}
     */
    public static function delete(
        PDO $pdo,
        int $adminId,
        int $targetId,
        string $confirmEmail,
        array $allowedRoles
    ): array {
        if ($targetId <= 0) {
            throw new \InvalidArgumentException('Account not found.');
        }
        if ($targetId === $adminId) {
            throw new \InvalidArgumentException('You cannot delete your own account.');
        }

        $stmt = $pdo->prepare('SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$targetId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new \InvalidArgumentException('Account not found.');
        }

        $role = (string) ($row['role'] ?? '');
        if ($role === 'super_admin') {
            throw new \InvalidArgumentException('A super administrator account cannot be deleted.');
        }
        if (!in_array($role, $allowedRoles, true)) {
            throw new \InvalidArgumentException('This account type cannot be deleted here.');
        }
        if (!in_array($role, self::DELETABLE_ROLES, true)) {
            throw new \InvalidArgumentException('This account type cannot be deleted.');
        }

        $expected = strtolower(trim((string) ($row['email'] ?? '')));
        $typed = strtolower(trim($confirmEmail));
        if ($expected === '' || $typed === '' || $typed !== $expected) {
            throw new \InvalidArgumentException('Type the account email exactly to confirm deletion.');
        }

        // Detach shop membership before user delete (shop itself is not removed here).
        try {
            $pdo->prepare('DELETE FROM shop_members WHERE user_id = ?')->execute([$targetId]);
        } catch (\Throwable) {
        }

        if (!AccountDeletionService::hardDeleteUser($pdo, $targetId)) {
            throw new \InvalidArgumentException('Could not delete account.');
        }

        return [
            'id'    => $targetId,
            'name'  => (string) ($row['name'] ?? ''),
            'email' => $expected,
            'role'  => $role,
        ];
    }

    /**
     * Delete a promoter by promoters.id (also removes the linked user).
     *
     * @return array{id:int,name:string,email:string,role:string,promoter_id:int}
     */
    public static function deletePromoter(PDO $pdo, int $adminId, int $promoterId, string $confirmEmail): array
    {
        if ($promoterId <= 0) {
            throw new \InvalidArgumentException('Promoter not found.');
        }

        $stmt = $pdo->prepare(
            'SELECT p.id AS promoter_id, u.id AS user_id, u.name, u.email, u.role
             FROM promoters p
             INNER JOIN users u ON u.id = p.user_id
             WHERE p.id = ?
             LIMIT 1'
        );
        $stmt->execute([$promoterId]);
        $row = $stmt->fetch();
        if ($row === false) {
            throw new \InvalidArgumentException('Promoter not found.');
        }

        $userId = (int) $row['user_id'];
        $role = (string) ($row['role'] ?? '');
        $expected = strtolower(trim((string) ($row['email'] ?? '')));
        $typed = strtolower(trim($confirmEmail));
        if ($expected === '' || $typed === '' || $typed !== $expected) {
            throw new \InvalidArgumentException('Type the account email exactly to confirm deletion.');
        }
        if ($userId === $adminId) {
            throw new \InvalidArgumentException('You cannot delete your own account.');
        }
        if ($role === 'super_admin') {
            throw new \InvalidArgumentException('A super administrator account cannot be deleted.');
        }

        // Remove promoter graph first so a missing ON DELETE CASCADE cannot block user delete.
        self::purgePromoterRows($pdo, $promoterId, $userId);

        try {
            $pdo->prepare('DELETE FROM shop_members WHERE user_id = ?')->execute([$userId]);
        } catch (\Throwable) {
        }

        if (!AccountDeletionService::hardDeleteUser($pdo, $userId)) {
            throw new \InvalidArgumentException('Could not delete account.');
        }

        // Safety: anonymize path may leave the login row; never leave a promoter profile behind.
        self::purgePromoterRows($pdo, $promoterId, $userId);

        return [
            'id'          => $userId,
            'name'        => (string) ($row['name'] ?? ''),
            'email'       => $expected,
            'role'        => $role !== '' ? $role : 'promoter',
            'promoter_id' => $promoterId,
        ];
    }

    /** Best-effort removal of promoter profile + wallet data. */
    private static function purgePromoterRows(PDO $pdo, int $promoterId, int $userId): void
    {
        /** @var list<array{0:string,1:list<int>}> $steps */
        $steps = [
            ['UPDATE subscription_referrals SET referrer_promoter_id = NULL WHERE referrer_promoter_id = ?', [$promoterId]],
            ['UPDATE promoter_applications SET promoter_id = NULL WHERE promoter_id = ?', [$promoterId]],
            ['UPDATE promoter_applications SET created_user_id = NULL WHERE created_user_id = ?', [$userId]],
            ['UPDATE promoter_applications SET reviewed_by = NULL WHERE reviewed_by = ?', [$userId]],
            ['UPDATE promoters SET approved_by = NULL WHERE approved_by = ?', [$userId]],
            ['DELETE FROM promoter_withdrawals WHERE promoter_id = ?', [$promoterId]],
            ['DELETE FROM promoter_wallet_transactions WHERE promoter_id = ?', [$promoterId]],
            ['DELETE FROM promoter_wallets WHERE promoter_id = ?', [$promoterId]],
            ['DELETE FROM promoters WHERE id = ? OR user_id = ?', [$promoterId, $userId]],
        ];

        foreach ($steps as [$sql, $params]) {
            try {
                $pdo->prepare($sql)->execute($params);
            } catch (\Throwable) {
            }
        }
    }
}
