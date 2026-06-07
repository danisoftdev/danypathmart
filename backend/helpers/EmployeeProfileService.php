<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class EmployeeProfileService
{
    /** @return list<array<string,mixed>> */
    public static function listWorkforce(PDO $pdo): array
    {
        $roles = EmployeeService::WORKFORCE_ROLES;
        $placeholders = implode(',', array_fill(0, count($roles), '?'));

        $stmt = $pdo->prepare(
            "SELECT e.id AS employee_id, e.staff_id, e.department, e.job_title, e.employment_type,
                    e.start_date, e.status AS employee_status, e.emergency_contact_name,
                    e.emergency_contact_phone, e.profile_notes, e.manager_user_id,
                    u.id AS user_id, u.name, u.email, u.phone, u.role, u.status AS user_status,
                    m.name AS manager_name
             FROM employees e
             INNER JOIN users u ON u.id = e.user_id
             LEFT JOIN users m ON m.id = e.manager_user_id
             WHERE u.role IN ({$placeholders})
             ORDER BY e.staff_id ASC, u.name ASC"
        );
        $stmt->execute($roles);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $employeeId, array $input): array
    {
        $existing = self::findById($pdo, $employeeId);
        if ($existing === null) {
            throw new \InvalidArgumentException('Employee not found.');
        }

        $department = trim((string) ($input['department'] ?? $existing['department'] ?? ''));
        $jobTitle = trim((string) ($input['job_title'] ?? $existing['job_title'] ?? ''));
        $employmentType = $input['employment_type'] ?? $existing['employment_type'];
        $startDate = $input['start_date'] ?? $existing['start_date'];
        $managerId = array_key_exists('manager_user_id', $input)
            ? ($input['manager_user_id'] !== null && $input['manager_user_id'] !== '' ? (int) $input['manager_user_id'] : null)
            : $existing['manager_user_id'];
        $emergencyName = trim((string) ($input['emergency_contact_name'] ?? $existing['emergency_contact_name'] ?? ''));
        $emergencyPhone = trim((string) ($input['emergency_contact_phone'] ?? $existing['emergency_contact_phone'] ?? ''));
        $notes = trim((string) ($input['profile_notes'] ?? $existing['profile_notes'] ?? ''));
        $status = $input['status'] ?? $existing['employee_status'];

        if (!in_array($employmentType, ['full_time', 'part_time', 'contract', null, ''], true)) {
            $employmentType = null;
        }
        if ($employmentType === '') {
            $employmentType = null;
        }
        if (!in_array($status, ['active', 'inactive'], true)) {
            $status = 'active';
        }

        if ($managerId !== null && $managerId === (int) $existing['user_id']) {
            throw new \InvalidArgumentException('Employee cannot be their own manager.');
        }

        $pdo->prepare(
            'UPDATE employees SET department = ?, job_title = ?, employment_type = ?, start_date = ?,
                    manager_user_id = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
                    profile_notes = ?, status = ? WHERE id = ?'
        )->execute([
            $department !== '' ? $department : null,
            $jobTitle !== '' ? $jobTitle : null,
            $employmentType,
            self::nullableDate($startDate),
            $managerId,
            $emergencyName !== '' ? $emergencyName : null,
            $emergencyPhone !== '' ? $emergencyPhone : null,
            $notes !== '' ? $notes : null,
            $status,
            $employeeId,
        ]);

        return self::findById($pdo, $employeeId) ?? [];
    }

    public static function countActive(PDO $pdo): int
    {
        try {
            return (int) $pdo->query("SELECT COUNT(*) FROM employees WHERE status = 'active'")->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    public static function countWithProfileBasics(PDO $pdo): int
    {
        try {
            return (int) $pdo->query(
                "SELECT COUNT(*) FROM employees
                 WHERE status = 'active'
                   AND (NULLIF(TRIM(COALESCE(department, '')), '') IS NOT NULL
                        OR NULLIF(TRIM(COALESCE(job_title, '')), '') IS NOT NULL)"
            )->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $employeeId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT e.id AS employee_id FROM employees e WHERE e.id = ? LIMIT 1'
        );
        $stmt->execute([$employeeId]);
        if ($stmt->fetch() === false) {
            return null;
        }

        $roles = EmployeeService::WORKFORCE_ROLES;
        $placeholders = implode(',', array_fill(0, count($roles), '?'));
        $stmt = $pdo->prepare(
            "SELECT e.id AS employee_id, e.staff_id, e.department, e.job_title, e.employment_type,
                    e.start_date, e.status AS employee_status, e.emergency_contact_name,
                    e.emergency_contact_phone, e.profile_notes, e.manager_user_id,
                    u.id AS user_id, u.name, u.email, u.phone, u.role, u.status AS user_status,
                    m.name AS manager_name
             FROM employees e
             INNER JOIN users u ON u.id = e.user_id
             LEFT JOIN users m ON m.id = e.manager_user_id
             WHERE e.id = ? AND u.role IN ({$placeholders})
             LIMIT 1"
        );
        $stmt->execute(array_merge([$employeeId], $roles));
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'employee_id'              => (int) $row['employee_id'],
            'user_id'                  => (int) $row['user_id'],
            'staff_id'                 => (string) $row['staff_id'],
            'name'                     => (string) $row['name'],
            'email'                    => (string) $row['email'],
            'phone'                    => $row['phone'] ?? null,
            'role'                     => (string) $row['role'],
            'user_status'              => (string) $row['user_status'],
            'employee_status'          => (string) $row['employee_status'],
            'department'               => $row['department'] ?? null,
            'job_title'                => $row['job_title'] ?? null,
            'employment_type'          => $row['employment_type'] ?? null,
            'start_date'               => $row['start_date'] ?? null,
            'manager_user_id'          => $row['manager_user_id'] !== null ? (int) $row['manager_user_id'] : null,
            'manager_name'             => $row['manager_name'] ?? null,
            'emergency_contact_name'   => $row['emergency_contact_name'] ?? null,
            'emergency_contact_phone'  => $row['emergency_contact_phone'] ?? null,
            'profile_notes'            => $row['profile_notes'] ?? null,
            'profile_complete'         => self::isProfileComplete($row),
        ];
    }

    /** @param array<string,mixed> $row */
    private static function isProfileComplete(array $row): bool
    {
        $dept = trim((string) ($row['department'] ?? ''));
        $title = trim((string) ($row['job_title'] ?? ''));

        return $dept !== '' || $title !== '';
    }

    private static function nullableDate(mixed $value): ?string
    {
        $v = trim((string) ($value ?? ''));
        if ($v === '') {
            return null;
        }

        return $v;
    }
}
