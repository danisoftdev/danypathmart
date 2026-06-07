<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class LeaveRequestService
{
    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT lr.*, e.staff_id, u.name AS employee_name, u.email AS employee_email,
                       r.name AS reviewer_name
                FROM leave_requests lr
                INNER JOIN employees e ON e.id = lr.employee_id
                INNER JOIN users u ON u.id = lr.user_id
                LEFT JOIN users r ON r.id = lr.reviewed_by
                WHERE 1=1';
        $params = [];
        if ($status !== null && $status !== '' && $status !== 'all') {
            $sql .= ' AND lr.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY lr.created_at DESC LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input, ?int $createdBy = null): array
    {
        $employeeId = (int) ($input['employee_id'] ?? 0);
        $employee = EmployeeProfileService::findById($pdo, $employeeId);
        if ($employee === null) {
            throw new \InvalidArgumentException('Employee not found.');
        }

        $row = self::normalizeInput($input);
        $pdo->prepare(
            'INSERT INTO leave_requests
                (employee_id, user_id, leave_type, start_date, end_date, days_requested, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $employeeId,
            (int) $employee['user_id'],
            $row['leave_type'],
            $row['start_date'],
            $row['end_date'],
            $row['days_requested'],
            $row['reason'],
            $row['status'],
        ]);

        return self::findById($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input, ?int $reviewerId = null): array
    {
        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Leave request not found.');
        }

        if (isset($input['status'])) {
            $status = (string) $input['status'];
            if (!in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
                throw new \InvalidArgumentException('Invalid status.');
            }
            $reviewNote = trim((string) ($input['review_note'] ?? ''));
            $pdo->prepare(
                'UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ? WHERE id = ?'
            )->execute([
                $status,
                in_array($status, ['approved', 'rejected'], true) ? $reviewerId : null,
                $reviewNote !== '' ? $reviewNote : null,
                $id,
            ]);

            return self::findById($pdo, $id) ?? [];
        }

        if ($existing['status'] !== 'pending') {
            throw new \InvalidArgumentException('Only pending requests can be edited.');
        }

        $row = self::normalizeInput(array_merge($existing, $input));
        $pdo->prepare(
            'UPDATE leave_requests SET leave_type = ?, start_date = ?, end_date = ?,
                    days_requested = ?, reason = ? WHERE id = ?'
        )->execute([
            $row['leave_type'],
            $row['start_date'],
            $row['end_date'],
            $row['days_requested'],
            $row['reason'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function countPending(PDO $pdo): int
    {
        try {
            return (int) $pdo->query("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'")->fetchColumn();
        } catch (\Throwable) {
            return 0;
        }
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT lr.*, e.staff_id, u.name AS employee_name, u.email AS employee_email,
                    r.name AS reviewer_name
             FROM leave_requests lr
             INNER JOIN employees e ON e.id = lr.employee_id
             INNER JOIN users u ON u.id = lr.user_id
             LEFT JOIN users r ON r.id = lr.reviewed_by
             WHERE lr.id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    /** @param array<string,mixed> $input */
    private static function normalizeInput(array $input): array
    {
        $start = trim((string) ($input['start_date'] ?? ''));
        $end = trim((string) ($input['end_date'] ?? ''));
        if ($start === '' || $end === '') {
            throw new \InvalidArgumentException('Start and end dates are required.');
        }
        if ($end < $start) {
            throw new \InvalidArgumentException('End date must be on or after start date.');
        }

        $type = strtolower(trim((string) ($input['leave_type'] ?? 'annual')));
        if (!in_array($type, ['annual', 'sick', 'unpaid', 'other'], true)) {
            $type = 'annual';
        }

        $reason = trim((string) ($input['reason'] ?? ''));
        if (strlen($reason) < 3) {
            throw new \InvalidArgumentException('Reason is required.');
        }

        $days = isset($input['days_requested']) ? (float) $input['days_requested'] : 0.0;
        if ($days <= 0) {
            $days = max(1.0, (float) ((strtotime($end) - strtotime($start)) / 86400) + 1);
        }

        $status = $input['status'] ?? 'pending';
        if (!in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
            $status = 'pending';
        }

        return [
            'leave_type'     => $type,
            'start_date'     => $start,
            'end_date'       => $end,
            'days_requested' => round($days, 1),
            'reason'         => $reason,
            'status'         => $status,
        ];
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'               => (int) $row['id'],
            'employee_id'      => (int) $row['employee_id'],
            'user_id'          => (int) $row['user_id'],
            'staff_id'         => (string) $row['staff_id'],
            'employee_name'    => (string) $row['employee_name'],
            'employee_email'   => (string) $row['employee_email'],
            'leave_type'       => (string) $row['leave_type'],
            'start_date'       => (string) $row['start_date'],
            'end_date'         => (string) $row['end_date'],
            'days_requested'   => (float) $row['days_requested'],
            'reason'           => (string) $row['reason'],
            'status'           => (string) $row['status'],
            'reviewed_by'      => $row['reviewed_by'] !== null ? (int) $row['reviewed_by'] : null,
            'reviewer_name'    => $row['reviewer_name'] ?? null,
            'reviewed_at'      => $row['reviewed_at'] ?? null,
            'review_note'      => $row['review_note'] ?? null,
            'created_at'       => $row['created_at'] ?? null,
        ];
    }
}
