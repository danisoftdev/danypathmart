<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Admin-issued shop registration invites. */
final class ShopInviteService
{
    public const EXPIRE_DAYS = 14;

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function create(PDO $pdo, array $input, int $adminUserId): array
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('A valid invite email is required.');
        }

        $token = bin2hex(random_bytes(24));
        $expiresAt = (new \DateTimeImmutable('now'))
            ->modify('+' . self::EXPIRE_DAYS . ' days')
            ->format('Y-m-d H:i:s');

        $pdo->prepare(
            'INSERT INTO shop_invites
                (token, email, business_name, contact_name, phone, city, note, created_by, status, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $token,
            $email,
            self::nullable($input['business_name'] ?? null),
            self::nullable($input['contact_name'] ?? null),
            self::nullable($input['phone'] ?? null),
            self::nullable($input['city'] ?? null),
            self::nullable($input['note'] ?? null),
            $adminUserId,
            'pending',
            $expiresAt,
        ]);

        $id = (int) $pdo->lastInsertId();

        return self::findById($pdo, $id) ?? [
            'id'         => $id,
            'token'      => $token,
            'email'      => $email,
            'invite_path'=> '/sell?invite=' . $token,
            'expires_at' => $expiresAt,
            'status'     => 'pending',
        ];
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM shop_invites WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function findByToken(PDO $pdo, string $token): ?array
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }
        $stmt = $pdo->prepare('SELECT * FROM shop_invites WHERE token = ? LIMIT 1');
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        $invite = self::formatRow($row);
        if ($invite['status'] === 'pending' && self::isExpired($invite['expires_at'] ?? null)) {
            $pdo->prepare('UPDATE shop_invites SET status = ? WHERE id = ? AND status = ?')
                ->execute(['expired', $invite['id'], 'pending']);
            $invite['status'] = 'expired';
        }

        return $invite;
    }

    /**
     * Public-safe payload for prefill on /sell?invite=TOKEN.
     *
     * @return array<string,mixed>
     */
    public static function publicShow(PDO $pdo, string $token): array
    {
        $invite = self::findByToken($pdo, $token);
        if ($invite === null) {
            throw new \InvalidArgumentException('Invite not found.');
        }
        if ($invite['status'] !== 'pending') {
            throw new \InvalidArgumentException(
                $invite['status'] === 'accepted'
                    ? 'This invite has already been used.'
                    : 'This invite is no longer valid.'
            );
        }

        return [
            'email'         => $invite['email'],
            'business_name' => $invite['business_name'],
            'contact_name'  => $invite['contact_name'],
            'phone'         => $invite['phone'],
            'city'          => $invite['city'],
            'expires_at'    => $invite['expires_at'],
            'token'         => $invite['token'],
        ];
    }

    public static function markAccepted(PDO $pdo, string $token, int $applicationId, ?int $shopId = null): void
    {
        $invite = self::findByToken($pdo, $token);
        if ($invite === null || $invite['status'] !== 'pending') {
            return;
        }

        $pdo->prepare(
            'UPDATE shop_invites
             SET status = ?, application_id = ?, shop_id = ?, accepted_at = NOW()
             WHERE id = ? AND status = ?'
        )->execute(['accepted', $applicationId, $shopId, $invite['id'], 'pending']);
    }

    private static function isExpired(?string $expiresAt): bool
    {
        if ($expiresAt === null || $expiresAt === '') {
            return true;
        }
        try {
            return new \DateTimeImmutable($expiresAt) < new \DateTimeImmutable('now');
        } catch (\Throwable) {
            return true;
        }
    }

    private static function nullable(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    /** @param array<string,mixed> $row */
    private static function formatRow(array $row): array
    {
        $token = (string) $row['token'];

        return [
            'id'              => (int) $row['id'],
            'token'           => $token,
            'email'           => $row['email'],
            'business_name'   => $row['business_name'] ?? null,
            'contact_name'    => $row['contact_name'] ?? null,
            'phone'           => $row['phone'] ?? null,
            'city'            => $row['city'] ?? null,
            'note'            => $row['note'] ?? null,
            'created_by'      => (int) $row['created_by'],
            'application_id'  => isset($row['application_id']) && $row['application_id'] !== null
                ? (int) $row['application_id'] : null,
            'shop_id'         => isset($row['shop_id']) && $row['shop_id'] !== null
                ? (int) $row['shop_id'] : null,
            'status'          => $row['status'],
            'expires_at'      => $row['expires_at'],
            'accepted_at'     => $row['accepted_at'] ?? null,
            'created_at'      => $row['created_at'] ?? null,
            'invite_path'     => '/sell?invite=' . $token,
        ];
    }
}
