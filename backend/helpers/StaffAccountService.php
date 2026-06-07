<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use Throwable;

/** Create staff accounts and hire from career applications. */
final class StaffAccountService
{
    /**
     * @param array{name:string,email:string,username?:string,role_name?:string,temp_password?:string,permissions?:array<string,mixed>} $input
     * @return array{user_id:int,name:string,username:string,email:string,temp_password:string,permissions:array<string,bool>,role_name:string,staff_id:string}
     */
    public static function createStaffAccount(PDO $pdo, int $createdByUserId, array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $username = trim((string) ($input['username'] ?? ''));
        $roleName = trim((string) ($input['role_name'] ?? ''));
        $tempPassword = (string) ($input['temp_password'] ?? '');
        $permissions = StaffPermission::sanitize(is_array($input['permissions'] ?? null) ? $input['permissions'] : []);

        if (!Validator::nonEmpty($name)) {
            throw new \InvalidArgumentException('Full name is required.');
        }
        if (!Validator::email($email)) {
            throw new \InvalidArgumentException('A valid email address is required.');
        }
        if ($roleName === '') {
            $roleName = 'Staff';
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

        $username = self::resolveUsername($pdo, $email, $username);
        $hash = password_hash($tempPassword, PASSWORD_BCRYPT, ['cost' => 12]);

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO users (name, username, email, password_hash, role, status, totp_enabled)
                 VALUES (?, ?, ?, ?, 'staff', 'verified', 0)"
            )->execute([$name, $username, $email, $hash]);
            $userId = (int) $pdo->lastInsertId();

            $pdo->prepare(
                'INSERT INTO staff_permissions (user_id, role_name, permissions, created_by)
                 VALUES (?, ?, ?, ?)'
            )->execute([$userId, $roleName, json_encode($permissions), $createdByUserId]);

            $employee = EmployeeService::issueForUser($pdo, $userId, $createdByUserId);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return [
            'user_id'       => $userId,
            'name'          => $name,
            'username'      => $username,
            'email'         => $email,
            'temp_password' => $tempPassword,
            'permissions'   => $permissions,
            'role_name'     => $roleName,
            'staff_id'      => $employee['staff_id'],
        ];
    }

    public static function resolveUsername(PDO $pdo, string $email, string $username): string
    {
        if ($username !== '') {
            $u = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
            $u->execute([$username]);
            if ($u->fetchColumn() !== false) {
                throw new \InvalidArgumentException('This username is already taken.');
            }
            return $username;
        }

        $base = preg_replace('/[^a-z0-9._-]/', '', strtolower(explode('@', $email)[0])) ?? 'staff';
        if (strlen($base) < 3) {
            $base = 'staff' . $base;
        }
        $base = substr($base, 0, 50);
        $candidate = $base;
        $suffix = 0;
        $u = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
        do {
            $u->execute([$candidate]);
            $taken = $u->fetchColumn() !== false;
            if ($taken) {
                $candidate = $base . (++$suffix);
            }
        } while ($taken);

        return $candidate;
    }
}
