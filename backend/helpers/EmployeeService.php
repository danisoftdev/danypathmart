<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/** Workforce employee IDs (DPM-EMP-####) for internal staff. */
final class EmployeeService
{
    public const STAFF_ID_PREFIX = 'DPM-EMP-';

    public const STAFF_ID_PAD_LENGTH = 4;

    /** @var list<string> */
    public const WORKFORCE_ROLES = ['super_admin', 'staff', 'driver', 'station_staff'];

    public static function formatStaffId(int $sequence): string
    {
        return self::STAFF_ID_PREFIX . str_pad(
            (string) max(1, $sequence),
            self::STAFF_ID_PAD_LENGTH,
            '0',
            STR_PAD_LEFT
        );
    }

    public static function isWorkforceRole(string $role): bool
    {
        return in_array($role, self::WORKFORCE_ROLES, true);
    }

    /** @return string|null */
    public static function staffIdForUserId(PDO $pdo, int $userId): ?string
    {
        if ($userId <= 0) {
            return null;
        }
        $stmt = $pdo->prepare('SELECT staff_id FROM employees WHERE user_id = ? AND status = ? LIMIT 1');
        $stmt->execute([$userId, 'active']);
        $id = $stmt->fetchColumn();

        return $id !== false ? (string) $id : null;
    }

    /**
     * Issue or return existing staff ID for a workforce user.
     *
     * @return array{staff_id:string,user_id:int,employee_id:int}
     */
    public static function issueForUser(PDO $pdo, int $userId, ?int $createdByUserId = null): array
    {
        if ($userId <= 0) {
            throw new \InvalidArgumentException('Invalid user.');
        }

        $existing = $pdo->prepare('SELECT id, staff_id FROM employees WHERE user_id = ? LIMIT 1');
        $existing->execute([$userId]);
        $row = $existing->fetch();
        if ($row !== false) {
            return [
                'staff_id'     => (string) $row['staff_id'],
                'user_id'      => $userId,
                'employee_id'  => (int) $row['id'],
            ];
        }

        $userStmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if ($user === false) {
            throw new \InvalidArgumentException('User not found.');
        }
        if (!self::isWorkforceRole((string) $user['role'])) {
            throw new \InvalidArgumentException('This account type does not receive a staff ID.');
        }

        $ownsTransaction = !$pdo->inTransaction();
        if ($ownsTransaction) {
            $pdo->beginTransaction();
        }

        try {
            $seqStmt = $pdo->query('SELECT next_value FROM staff_id_sequences WHERE id = 1 FOR UPDATE');
            $seqRow = $seqStmt !== false ? $seqStmt->fetch() : false;
            if ($seqRow === false) {
                $pdo->exec('INSERT INTO staff_id_sequences (id, next_value) VALUES (1, 1)');
                $next = 1;
            } else {
                $next = (int) $seqRow['next_value'];
                if ($next < 1) {
                    $next = 1;
                }
            }

            $staffId = self::formatStaffId($next);
            $pdo->prepare('UPDATE staff_id_sequences SET next_value = ? WHERE id = 1')->execute([$next + 1]);
            $pdo->prepare(
                'INSERT INTO employees (user_id, staff_id, created_by, status) VALUES (?, ?, ?, ?)'
            )->execute([$userId, $staffId, $createdByUserId, 'active']);

            $employeeId = (int) $pdo->lastInsertId();

            if ($ownsTransaction) {
                $pdo->commit();
            }

            return [
                'staff_id'    => $staffId,
                'user_id'     => $userId,
                'employee_id' => $employeeId,
            ];
        } catch (Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** Backfill staff IDs for existing workforce users (migration). */
    public static function backfillExistingWorkforce(PDO $pdo): int
    {
        $placeholders = implode(',', array_fill(0, count(self::WORKFORCE_ROLES), '?'));
        $stmt = $pdo->prepare(
            "SELECT u.id FROM users u
             LEFT JOIN employees e ON e.user_id = u.id
             WHERE u.role IN ({$placeholders}) AND e.id IS NULL
             ORDER BY u.created_at ASC, u.id ASC"
        );
        $stmt->execute(self::WORKFORCE_ROLES);

        $count = 0;
        foreach ($stmt->fetchAll() as $row) {
            self::issueForUser($pdo, (int) $row['id'], null);
            $count++;
        }

        return $count;
    }
}
