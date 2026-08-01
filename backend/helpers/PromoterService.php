<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Promoter accounts for subscription referral program. */
final class PromoterService
{
    /** @return array<string,mixed>|null */
    public static function findByUserId(PDO $pdo, int $userId): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM promoters WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM promoters WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT p.*, u.email, u.name AS user_name FROM promoters p INNER JOIN users u ON u.id = p.user_id';
        $params = [];
        if ($status !== null && $status !== '') {
            $sql .= ' WHERE p.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY p.created_at DESC LIMIT 200';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => self::format($r) + [
            'email'     => $r['email'],
            'user_name' => $r['user_name'],
        ], $stmt->fetchAll());
    }

    /**
     * @param array{
     *   name:string,email:string,password:string,display_name?:string,code?:string,
     *   must_change_password?:bool,status?:string,phone?:string
     * } $input
     * @return array<string,mixed>
     */
    public static function create(PDO $pdo, array $input, int $adminId): array
    {
        $name = trim((string) ($input['name'] ?? $input['display_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $displayName = trim((string) ($input['display_name'] ?? $name));
        $code = self::normalizeCode((string) ($input['code'] ?? ''));
        $mustChange = !empty($input['must_change_password']);
        $userStatus = (string) ($input['status'] ?? 'verified');
        if (!in_array($userStatus, ['unverified', 'verified'], true)) {
            $userStatus = 'verified';
        }
        $phone = trim((string) ($input['phone'] ?? ''));

        if ($displayName === '' || $email === '' || strlen($password) < 8) {
            throw new \InvalidArgumentException('Name, email, and password (8+ chars) are required.');
        }
        if ($code === '') {
            $code = self::generateCode($pdo, $displayName);
        }
        self::assertCodeAvailable($pdo, $code);

        $emailCheck = AvailabilityService::check($pdo, 'email', $email);
        if (!$emailCheck['available']) {
            throw new \InvalidArgumentException($emailCheck['message']);
        }

        $usernameBase = preg_replace('/[^a-z0-9._-]/', '', strtolower(explode('@', $email)[0])) ?? 'promoter';
        if (strlen($usernameBase) < 3) {
            $usernameBase = 'promoter' . $usernameBase;
        }
        $username = substr($usernameBase, 0, 50);
        for ($n = 0; $n < 100; $n++) {
            $try = $n === 0 ? $username : $username . $n;
            $chk = AvailabilityService::check($pdo, 'username', $try);
            if ($chk['available']) {
                $username = $try;
                break;
            }
        }

        $pdo->beginTransaction();
        try {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $display = $name !== '' ? $name : $displayName;
            try {
                // Match staff/driver inserts — do not require email_verified_at (absent on some DBs).
                try {
                    $pdo->prepare(
                        "INSERT INTO users (name, username, email, phone, password_hash, role, status, must_change_password)
                         VALUES (?, ?, ?, ?, ?, 'promoter', ?, ?)"
                    )->execute([
                        $display,
                        $username,
                        $email,
                        $phone !== '' ? $phone : null,
                        $hash,
                        $userStatus,
                        $mustChange ? 1 : 0,
                    ]);
                } catch (\Throwable) {
                    $pdo->prepare(
                        "INSERT INTO users (name, username, email, password_hash, role, status)
                         VALUES (?, ?, ?, ?, 'promoter', ?)"
                    )->execute([$display, $username, $email, $hash, $userStatus]);
                    if ($mustChange) {
                        try {
                            $uid = (int) $pdo->lastInsertId();
                            $pdo->prepare('UPDATE users SET must_change_password = 1 WHERE id = ?')->execute([$uid]);
                        } catch (\Throwable) {
                            // Column may not exist until migration 077.
                        }
                    }
                }
            } catch (\Throwable $roleErr) {
                $msg = $roleErr->getMessage();
                if (str_contains($msg, 'role') || str_contains($msg, 'Data truncated')) {
                    throw new \InvalidArgumentException(
                        'Could not create promoter user (role may be missing). Deploy migration 070, then retry. ' . $msg
                    );
                }
                throw new \InvalidArgumentException('Could not create promoter user. ' . $msg);
            }
            $userId = (int) $pdo->lastInsertId();

            try {
                $pdo->prepare(
                    'INSERT INTO promoters (user_id, display_name, code, status, approved_by, approved_at)
                     VALUES (?, ?, ?, ?, ?, NOW())'
                )->execute([$userId, $displayName, $code, 'active', $adminId]);
            } catch (\Throwable $promoErr) {
                throw new \InvalidArgumentException(
                    'Could not create promoter profile. ' . $promoErr->getMessage()
                );
            }
            $promoterId = (int) $pdo->lastInsertId();
            PromoterWalletService::getWallet($pdo, $promoterId);

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        return self::findById($pdo, $promoterId) ?? [];
    }

    public static function setStatus(PDO $pdo, int $promoterId, string $status, int $adminId): void
    {
        if (!in_array($status, ['pending', 'active', 'suspended'], true)) {
            throw new \InvalidArgumentException('Invalid status.');
        }
        $approvedAt = $status === 'active' ? date('Y-m-d H:i:s') : null;
        $pdo->prepare(
            'UPDATE promoters SET status = ?, approved_by = ?, approved_at = COALESCE(?, approved_at) WHERE id = ?'
        )->execute([$status, $adminId, $approvedAt, $promoterId]);
    }

    /** @return array<string,mixed> */
    public static function dashboard(PDO $pdo, int $promoterId): array
    {
        $promoter = self::findById($pdo, $promoterId);
        if ($promoter === null) {
            throw new \InvalidArgumentException('Promoter not found.');
        }

        $settings = SubscriptionReferralService::settings($pdo);
        $wallet = PromoterWalletService::getWallet($pdo, $promoterId);
        $referrals = SubscriptionReferralService::referralsForPromoter($pdo, $promoterId);

        return [
            'promoter'    => $promoter,
            'wallet'      => $wallet,
            'program'     => $settings,
            'referrals'   => $referrals,
            'share_url'   => '/sell?ref=' . urlencode($promoter['code']),
        ];
    }

    private static function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($code))) ?? '');
    }

    private static function generateCode(PDO $pdo, string $base): string
    {
        $seed = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', strtoupper($base)) ?? 'PROMO', 0, 6));
        if (strlen($seed) < 4) {
            $seed = 'PROMO';
        }
        for ($n = 0; $n < 100; $n++) {
            $try = $n === 0 ? $seed : $seed . $n;
            try {
                $chk = $pdo->prepare('SELECT 1 FROM promoters WHERE code = ?');
                $chk->execute([$try]);
                if ($chk->fetch() === false && ShopReferralService::resolveShop($pdo, $try) === null) {
                    return $try;
                }
            } catch (\Throwable) {
                return $try;
            }
        }

        return $seed . bin2hex(random_bytes(2));
    }

    private static function assertCodeAvailable(PDO $pdo, string $code): void
    {
        $chk = $pdo->prepare('SELECT 1 FROM promoters WHERE code = ?');
        $chk->execute([$code]);
        if ($chk->fetch() !== false) {
            throw new \InvalidArgumentException('Promoter code is already in use.');
        }
        if (ShopReferralService::resolveShop($pdo, $code) !== null) {
            throw new \InvalidArgumentException('Code conflicts with an existing shop referral code.');
        }
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'           => (int) $row['id'],
            'user_id'      => (int) $row['user_id'],
            'display_name' => $row['display_name'],
            'code'         => $row['code'],
            'status'       => $row['status'],
            'approved_by'  => $row['approved_by'] !== null ? (int) $row['approved_by'] : null,
            'approved_at'  => $row['approved_at'] ?? null,
            'created_at'   => $row['created_at'],
        ];
    }
}
