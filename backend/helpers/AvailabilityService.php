<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Live uniqueness checks for registration / shop naming. */
final class AvailabilityService
{
    public const TYPES = ['email', 'username', 'name', 'shop_name', 'shop_slug'];

    /**
     * @return array{available:bool,verified:bool,message:string,normalized:string}
     */
    public static function check(PDO $pdo, string $type, string $value, ?int $excludeUserId = null, ?int $excludeShopId = null): array
    {
        $type = strtolower(trim($type));
        if (!in_array($type, self::TYPES, true)) {
            return [
                'available'  => false,
                'verified'   => false,
                'message'    => 'Unknown check type.',
                'normalized' => '',
            ];
        }

        $raw = trim($value);
        if ($raw === '') {
            return [
                'available'  => false,
                'verified'   => false,
                'message'    => 'Enter a value to check.',
                'normalized' => '',
            ];
        }

        return match ($type) {
            'email'     => self::checkEmail($pdo, $raw, $excludeUserId),
            'username'  => self::checkUsername($pdo, $raw, $excludeUserId),
            'name'      => self::checkDisplayName($pdo, $raw, $excludeUserId),
            'shop_name' => self::checkShopName($pdo, $raw, $excludeShopId),
            'shop_slug' => self::checkShopSlug($pdo, $raw, $excludeShopId),
            default     => [
                'available'  => false,
                'verified'   => false,
                'message'    => 'Unknown check type.',
                'normalized' => '',
            ],
        };
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function checkEmail(PDO $pdo, string $email, ?int $excludeUserId): array
    {
        $email = strtolower($email);
        if (!Validator::email($email)) {
            return self::fail($email, 'Enter a valid email address.');
        }
        // Live accounts (incl. 14-day deletion window) reserve the email. Hard-deleted /
        // anonymized (disabled) rows do not, so the address can be registered again.
        $sql = "SELECT id, status FROM users
                WHERE email = ?
                  AND status IN ('unverified', 'verified', 'pending_deletion')";
        $params = [$email];
        if ($excludeUserId !== null && $excludeUserId > 0) {
            $sql .= ' AND id != ?';
            $params[] = $excludeUserId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row !== false) {
            $msg = (($row['status'] ?? '') === 'pending_deletion')
                ? 'This email is in use on an account scheduled for deletion. Sign in to restore it, or wait until it is permanently removed.'
                : 'This email is already in use.';

            return self::fail($email, $msg);
        }

        return self::ok($email, 'Email is available.');
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function checkUsername(PDO $pdo, string $username, ?int $excludeUserId): array
    {
        if (!Validator::username($username)) {
            return self::fail($username, 'Username must be 3–60 characters (letters, numbers, . _ -).');
        }
        $sql = "SELECT id, status FROM users
                WHERE LOWER(username) = LOWER(?)
                  AND status IN ('unverified', 'verified', 'pending_deletion')";
        $params = [$username];
        if ($excludeUserId !== null && $excludeUserId > 0) {
            $sql .= ' AND id != ?';
            $params[] = $excludeUserId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row !== false) {
            $msg = (($row['status'] ?? '') === 'pending_deletion')
                ? 'This username is in use on an account scheduled for deletion. Sign in to restore it, or wait until it is permanently removed.'
                : 'This username is already in use.';

            return self::fail($username, $msg);
        }

        return self::ok($username, 'Username is available.');
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function checkDisplayName(PDO $pdo, string $name, ?int $excludeUserId): array
    {
        if (mb_strlen($name) < 2) {
            return self::fail($name, 'Name is too short.');
        }
        // Hold names during pending deletion; anonymized (disabled) accounts free the name.
        $sql = "SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(?) AND status != 'disabled'";
        $params = [$name];
        if ($excludeUserId !== null && $excludeUserId > 0) {
            $sql .= ' AND id != ?';
            $params[] = $excludeUserId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        if ($stmt->fetch() !== false) {
            return self::fail($name, 'This name is already in use. Choose another.');
        }

        return self::ok($name, 'Name is unique.');
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function checkShopName(PDO $pdo, string $name, ?int $excludeShopId): array
    {
        if (mb_strlen($name) < 2) {
            return self::fail($name, 'Shop name is too short.');
        }

        $sql = 'SELECT id FROM shops WHERE LOWER(TRIM(name)) = LOWER(?)';
        $params = [$name];
        if ($excludeShopId !== null && $excludeShopId > 0) {
            $sql .= ' AND id != ?';
            $params[] = $excludeShopId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        if ($stmt->fetch() !== false) {
            return self::fail($name, 'A shop with this name already exists.');
        }

        $app = $pdo->prepare(
            "SELECT id FROM shop_applications
             WHERE LOWER(TRIM(business_name)) = LOWER(?) AND status IN ('new','pending_payment')
             LIMIT 1"
        );
        $app->execute([$name]);
        if ($app->fetch() !== false) {
            return self::fail($name, 'This shop name is already in an open application.');
        }

        return self::ok($name, 'Shop name is available.');
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function checkShopSlug(PDO $pdo, string $slug, ?int $excludeShopId): array
    {
        $slug = strtolower(trim($slug));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');
        if ($slug === '' || strlen($slug) < 2) {
            return self::fail($slug, 'Shop link is too short.');
        }
        $sql = 'SELECT id FROM shops WHERE slug = ?';
        $params = [$slug];
        if ($excludeShopId !== null && $excludeShopId > 0) {
            $sql .= ' AND id != ?';
            $params[] = $excludeShopId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        if ($stmt->fetch() !== false) {
            return self::fail($slug, 'This shop link is already taken.');
        }

        return self::ok($slug, 'Shop link is available.');
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function ok(string $normalized, string $message): array
    {
        return [
            'available'  => true,
            'verified'   => true,
            'message'    => $message,
            'normalized' => $normalized,
        ];
    }

    /** @return array{available:bool,verified:bool,message:string,normalized:string} */
    private static function fail(string $normalized, string $message): array
    {
        return [
            'available'  => false,
            'verified'   => false,
            'message'    => $message,
            'normalized' => $normalized,
        ];
    }
}
