<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
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
        $invite = self::findById($pdo, $id) ?? [
            'id'          => $id,
            'token'       => $token,
            'email'       => $email,
            'invite_path' => '/sell?invite=' . $token,
            'expires_at'  => $expiresAt,
            'status'      => 'pending',
        ];

        $invite['invite_url'] = self::absoluteInviteUrl((string) ($invite['invite_path'] ?? ('/sell?invite=' . $token)));
        try {
            self::notifyInvitee($pdo, $invite);
        } catch (\Throwable $e) {
            error_log('Shop invite notify failed: ' . $e->getMessage());
        }

        return $invite;
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

    /** Absolute storefront URL for /sell?invite=TOKEN. */
    public static function absoluteInviteUrl(string $invitePath): string
    {
        Env::load();
        $origin = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $path = str_starts_with($invitePath, '/') ? $invitePath : '/' . $invitePath;

        return $origin . $path;
    }

    /**
     * Email always; in-app/push/SMS/WhatsApp when the invitee already has an account.
     * SMS/WhatsApp also sent to the invite phone when provided and no matching user.
     *
     * @param array<string,mixed> $invite
     */
    private static function notifyInvitee(PDO $pdo, array $invite): void
    {
        $email = strtolower(trim((string) ($invite['email'] ?? '')));
        $invitePath = (string) ($invite['invite_path'] ?? '');
        $inviteUrl = (string) ($invite['invite_url'] ?? self::absoluteInviteUrl($invitePath));
        $business = trim((string) ($invite['business_name'] ?? ''));
        $contactName = trim((string) ($invite['contact_name'] ?? ''));
        $note = trim((string) ($invite['note'] ?? ''));
        $expiresAt = (string) ($invite['expires_at'] ?? '');
        $phone = trim((string) ($invite['phone'] ?? ''));

        $title = $business !== ''
            ? 'Shop invite — ' . $business
            : 'You\'re invited to sell on DanyPathMart';

        $bodyParts = [
            $business !== ''
                ? "You are invited to register \"{$business}\" on DanyPathMart."
                : 'You are invited to open a shop on DanyPathMart.',
        ];
        if ($note !== '') {
            $bodyParts[] = 'Note: ' . $note;
        }
        $bodyParts[] = 'Open your invite link to register:';
        $bodyParts[] = $inviteUrl;
        if ($expiresAt !== '') {
            $bodyParts[] = 'This invite expires on ' . $expiresAt . '.';
        }
        $body = implode("\n\n", $bodyParts);

        $mailCtx = [
            'invite_url'    => $inviteUrl,
            'invite_path'   => $invitePath,
            'business_name' => $business !== '' ? $business : null,
            'contact_name'  => $contactName !== '' ? $contactName : null,
            'note'          => $note !== '' ? $note : null,
            'expires_at'    => $expiresAt !== '' ? $expiresAt : null,
        ];

        $userId = null;
        if ($email !== '') {
            $stmt = $pdo->prepare(
                "SELECT id, name FROM users WHERE LOWER(email) = ? AND status != 'disabled' LIMIT 1"
            );
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if ($user !== false) {
                $userId = (int) $user['id'];
                if ($contactName === '') {
                    $contactName = trim((string) ($user['name'] ?? ''));
                }
            }
        }

        if ($userId !== null && $userId > 0) {
            NotificationService::notifyUser(
                $pdo,
                $userId,
                $title,
                $body,
                $invitePath !== '' ? $invitePath : '/sell',
                'shop_invite',
                true,
                true,
                true,
                true,
                static function (string $toEmail, string $toName) use ($mailCtx, $contactName): void {
                    Mailer::shopInvite(
                        $toEmail,
                        $contactName !== '' ? $contactName : $toName,
                        $mailCtx
                    );
                }
            );

            return;
        }

        if ($email !== '') {
            Mailer::shopInvite(
                $email,
                $contactName !== '' ? $contactName : 'Seller',
                $mailCtx
            );
        }

        if ($phone !== '') {
            self::sendInviteToPhone($pdo, $phone, $title, $body);
        }
    }

    private static function sendInviteToPhone(PDO $pdo, string $phone, string $title, string $body): void
    {
        try {
            $settings = MessagingIntegrationService::load($pdo);
            $text = NotificationChannelService::smsText($title, $body);
            if ($settings['sms_api_enabled'] && $settings['sms_configured']) {
                MessagingIntegrationService::sendSms($pdo, $phone, $text, $title);
            }
            if ($settings['whatsapp_api_enabled'] && $settings['whatsapp_configured']) {
                MessagingIntegrationService::sendWhatsApp($pdo, $phone, $text, $title);
            }
        } catch (\Throwable $e) {
            error_log('Shop invite messaging failed: ' . $e->getMessage());
        }
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
        $invitePath = '/sell?invite=' . $token;

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
            'invite_path'     => $invitePath,
            'invite_url'      => self::absoluteInviteUrl($invitePath),
        ];
    }
}
