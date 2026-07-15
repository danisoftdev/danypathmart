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

        $deleted = self::delete(
            $pdo,
            $adminId,
            (int) $row['user_id'],
            $confirmEmail,
            ['promoter']
        );

        return $deleted + ['promoter_id' => (int) $row['promoter_id']];
    }
}
