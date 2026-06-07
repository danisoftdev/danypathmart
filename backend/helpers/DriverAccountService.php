<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/** Driver login accounts (hub ↔ station runs, Phase M7). */
final class DriverAccountService
{
    /**
     * @param array{name:string,email:string,username?:string,phone?:string,temp_password?:string} $input
     * @return array{user_id:int,name:string,username:string,email:string,temp_password:string,staff_id:string}
     */
    public static function createDriverAccount(PDO $pdo, array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? ''));
        $username = trim((string) ($input['username'] ?? ''));
        $phone = trim((string) ($input['phone'] ?? ''));
        $tempPassword = (string) ($input['temp_password'] ?? '');

        if (!Validator::nonEmpty($name)) {
            throw new \InvalidArgumentException('Full name is required.');
        }
        if (!Validator::email($email)) {
            throw new \InvalidArgumentException('A valid email address is required.');
        }
        if ($username !== '' && !Validator::username($username)) {
            throw new \InvalidArgumentException('Username may only contain letters, numbers, dots, hyphens and underscores (3-60 chars).');
        }

        if ($tempPassword === '') {
            $tempPassword = 'Dpm' . bin2hex(random_bytes(4)) . random_int(10, 99) . '!';
        } elseif (!Validator::passwordStrong($tempPassword)) {
            throw new \InvalidArgumentException('Temporary password must be at least 8 characters and include an uppercase letter and a number.');
        }

        $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $check->execute([$email]);
        if ($check->fetchColumn() !== false) {
            throw new \InvalidArgumentException('An account with this email already exists.');
        }

        $username = StaffAccountService::resolveUsername($pdo, $email, $username);
        $hash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO users (name, username, email, phone, password_hash, role, status, totp_enabled)
                 VALUES (?, ?, ?, ?, ?, 'driver', 'verified', 0)"
            )->execute([
                $name,
                $username,
                $email,
                $phone !== '' ? $phone : null,
                $hash,
            ]);
            $userId = (int) $pdo->lastInsertId();
            $employee = EmployeeService::issueForUser($pdo, $userId, null);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return [
            'user_id'       => $userId,
            'name'          => $name,
            'username'      => $username,
            'email'         => $email,
            'temp_password' => $tempPassword,
            'staff_id'      => $employee['staff_id'],
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function listDrivers(PDO $pdo): array
    {
        $stmt = $pdo->query(
            "SELECT u.id, u.name, u.username, u.email, u.phone, u.status, u.created_at, e.staff_id
             FROM users u
             LEFT JOIN employees e ON e.user_id = u.id
             WHERE u.role = 'driver' AND u.status != 'disabled'
             ORDER BY u.name ASC"
        );

        return array_map(static fn (array $r): array => [
            'id'         => (int) $r['id'],
            'name'       => $r['name'],
            'username'   => $r['username'],
            'email'      => $r['email'],
            'phone'      => $r['phone'],
            'status'     => $r['status'],
            'staff_id'   => $r['staff_id'] ?? null,
            'created_at' => $r['created_at'],
        ], $stmt->fetchAll());
    }
}
