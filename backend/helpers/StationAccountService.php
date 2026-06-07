<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Station staff accounts (repack + release, Phase M8). */
final class StationAccountService
{
    /**
     * @param array{name:string,email:string,username?:string,phone?:string,pickup_station_id:int,temp_password?:string} $input
use Throwable;
     * @return array{user_id:int,name:string,username:string,email:string,pickup_station_id:int,temp_password:string}
     */
    public static function createStationStaffAccount(PDO $pdo, array $input): array
    {
        StationRepackService::assertEnabled($pdo);

        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? ''));
        $username = trim((string) ($input['username'] ?? ''));
        $phone = trim((string) ($input['phone'] ?? ''));
        $stationId = (int) ($input['pickup_station_id'] ?? 0);
        $tempPassword = (string) ($input['temp_password'] ?? '');

     * @return array{user_id:int,name:string,username:string,email:string,pickup_station_id:int,temp_password:string,staff_id:string}
            throw new \InvalidArgumentException('Full name is required.');
        }
        if (!Validator::email($email)) {
            throw new \InvalidArgumentException('A valid email address is required.');
        }
        if ($stationId <= 0) {
            throw new \InvalidArgumentException('Assign a pickup station for this staff member.');
        if ($station->fetch() === false) {
            throw new \InvalidArgumentException('Pickup station not found.');
        $email = strtolower(trim((string) ($input['email'] ?? '')));

        $username = trim((string) ($input['username'] ?? ''));

        $phone = trim((string) ($input['phone'] ?? ''));

        $stationId = (int) ($input['pickup_station_id'] ?? 0);

        $tempPassword = (string) ($input['temp_password'] ?? '');



        if (!Validator::nonEmpty($name)) {

            throw new \InvalidArgumentException('Full name is required.');

        }

        if (!Validator::email($email)) {

            throw new \InvalidArgumentException('A valid email address is required.');

        }

        if ($stationId <= 0) {

            throw new \InvalidArgumentException('Assign a pickup station for this staff member.');

        }



        $station = $pdo->prepare('SELECT id, name FROM pickup_stations WHERE id = ? AND is_active = 1');

        $station->execute([$stationId]);

        if ($station->fetch() === false) {

            throw new \InvalidArgumentException('Pickup station not found.');

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
                "INSERT INTO users (name, username, email, phone, password_hash, role, status, totp_enabled, assigned_pickup_station_id)
                 VALUES (?, ?, ?, ?, ?, 'station_staff', 'verified', 0, ?)"
            )->execute([
                $name,
                $username,
                $email,
                $phone !== '' ? $phone : null,
                $hash,
                $stationId,
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
            'user_id'           => $userId,
            'name'              => $name,
            'username'          => $username,
            'email'             => $email,
            'pickup_station_id' => $stationId,
            'temp_password'     => $tempPassword,
            'staff_id'          => $employee['staff_id'],
        ];

    }



    /** @return list<array<string,mixed>> */

    public static function listStationStaff(PDO $pdo, ?int $stationId = null): array

    {

        $sql = "SELECT u.id, u.name, u.username, u.email, u.phone, u.status, u.created_at,
                       u.assigned_pickup_station_id, ps.name AS station_name, ps.city AS station_city,
                       e.staff_id
                FROM users u
                LEFT JOIN pickup_stations ps ON ps.id = u.assigned_pickup_station_id
                LEFT JOIN employees e ON e.user_id = u.id
                WHERE u.role = 'station_staff' AND u.status != 'disabled'";

        $params = [];

        if ($stationId !== null && $stationId > 0) {

            $sql .= ' AND u.assigned_pickup_station_id = ?';

            $params[] = $stationId;

        }

        $sql .= ' ORDER BY ps.name ASC, u.name ASC';



        $stmt = $pdo->prepare($sql);

        $stmt->execute($params);



        return array_map(static fn (array $r): array => [

            'id'                => (int) $r['id'],

            'name'              => $r['name'],

            'username'          => $r['username'],

            'email'             => $r['email'],

            'phone'             => $r['phone'],

            'status'            => $r['status'],

            'pickup_station_id' => $r['assigned_pickup_station_id'] !== null ? (int) $r['assigned_pickup_station_id'] : null,

            'station_name'      => $r['station_name'],

            'station_city'      => $r['station_city'],
            'staff_id'          => $r['staff_id'] ?? null,
            'created_at'        => $r['created_at'],