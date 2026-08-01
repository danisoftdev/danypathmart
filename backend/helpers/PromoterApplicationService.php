<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;

/** Public promoter applications and admin one-click account creation. */
final class PromoterApplicationService
{
    /**
     * @param array{full_name:string,email:string,phone?:string,city?:string,experience?:string,why_join?:string} $input
     * @return array{id:int,email:string}
     */
    public static function submit(PDO $pdo, array $input): array
    {
        $name = trim((string) ($input['full_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));
        $experience = trim((string) ($input['experience'] ?? ''));
        $why = trim((string) ($input['why_join'] ?? ''));

        if ($name === '' || mb_strlen($name) < 2) {
            throw new \InvalidArgumentException('Please enter your full name.');
        }
        if ($email === '' || !Validator::email($email)) {
            throw new \InvalidArgumentException('Please enter a valid email address.');
        }
        if ($phone === '') {
            throw new \InvalidArgumentException('Please enter your phone number.');
        }
        if ($city === '') {
            throw new \InvalidArgumentException('Please enter your city.');
        }
        if ($why === '') {
            throw new \InvalidArgumentException('Please tell us why you want to become a promoter.');
        }

        $dup = $pdo->prepare(
            "SELECT id FROM promoter_applications WHERE email = ? AND status = 'new' LIMIT 1"
        );
        $dup->execute([$email]);
        if ($dup->fetch() !== false) {
            throw new \InvalidArgumentException('You already have an open promoter application with this email.');
        }

        $emailCheck = AvailabilityService::check($pdo, 'email', $email);
        if (!$emailCheck['available']) {
            throw new \InvalidArgumentException('An account already exists with this email. Sign in instead, or use another email.');
        }

        $pdo->prepare(
            'INSERT INTO promoter_applications (full_name, email, phone, city, experience, why_join, status)
             VALUES (?, ?, ?, ?, ?, ?, \'new\')'
        )->execute([$name, $email, $phone, $city, $experience !== '' ? $experience : null, $why]);

        $id = (int) $pdo->lastInsertId();
        $row = self::findById($pdo, $id);
        if ($row === null) {
            throw new \RuntimeException('Could not save application.');
        }

        // Applicant copy first — most important for the sender.
        $applicantSent = false;
        try {
            $applicantSent = Mailer::promoterApplicationToApplicant($email, $name, $row);
            if (!$applicantSent) {
                error_log('promoter apply applicant mail failed: ' . (Mailer::lastError() ?: 'unknown'));
            }
        } catch (\Throwable $e) {
            error_log('promoter apply applicant mail exception: ' . $e->getMessage());
        }

        Env::load();
        $adminEmail = trim((string) Env::get('ADMIN_EMAIL', 'admin@danypathmart.store'));
        try {
            if ($adminEmail !== '' && !Mailer::promoterApplicationToAdmin($adminEmail, $row)) {
                error_log('promoter apply admin mail failed: ' . (Mailer::lastError() ?: 'unknown'));
            }
        } catch (\Throwable $e) {
            error_log('promoter apply admin mail exception: ' . $e->getMessage());
        }

        try {
            NotificationService::notifyAdmins(
                $pdo,
                'Promoter application — ' . $name,
                "{$name} ({$email})\nPhone: {$phone}\nCity: {$city}\n\n{$why}",
                '/admin/marketplace?tab=promoters',
                'admin_contact'
            );
        } catch (\Throwable $e) {
            error_log('promoter apply notifyAdmins: ' . $e->getMessage());
        }

        return ['id' => $id, 'email' => $email, 'email_sent' => $applicantSent];
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT * FROM promoter_applications';
        $params = [];
        if ($status !== null && $status !== '' && $status !== 'all') {
            $sql .= ' WHERE status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY created_at DESC LIMIT 200';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $r): array => self::format($r), $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM promoter_applications WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::format($row);
    }

    /**
     * Create promoter account from an application (system temp password; applicant must change it).
     *
     * @return array{promoter:array<string,mixed>,temp_password:string,application:array<string,mixed>}
     */
    public static function approveAndCreate(PDO $pdo, int $applicationId, int $adminId, ?string $code = null): array
    {
        $app = self::findById($pdo, $applicationId);
        if ($app === null) {
            throw new \InvalidArgumentException('Application not found.');
        }
        if (($app['status'] ?? '') !== 'new') {
            throw new \InvalidArgumentException('This application was already reviewed.');
        }

        $tempPassword = self::generateTempPassword();
        $promoter = PromoterService::create($pdo, [
            'name'                 => $app['full_name'],
            'display_name'         => $app['full_name'],
            'email'                => $app['email'],
            'password'             => $tempPassword,
            'code'                 => $code ?? '',
            'must_change_password' => true,
            'status'               => 'unverified',
            'phone'                => $app['phone'],
        ], $adminId);

        $userId = (int) ($promoter['user_id'] ?? 0);
        $promoterId = (int) ($promoter['id'] ?? 0);

        $pdo->prepare(
            "UPDATE promoter_applications
             SET status = 'approved', created_user_id = ?, promoter_id = ?, reviewed_by = ?, reviewed_at = NOW()
             WHERE id = ?"
        )->execute([$userId, $promoterId, $adminId, $applicationId]);

        $otp = '';
        try {
            $otp = OTPService::issue($userId, 'registration');
        } catch (\Throwable $e) {
            error_log('promoter approve OTP: ' . $e->getMessage());
        }

        $toEmail = (string) $app['email'];
        $toName = (string) $app['full_name'];
        $mailSent = false;

        try {
            $mailSent = Mailer::promoterAccountCreated($toEmail, $toName, [
                'temp_password' => $tempPassword,
                'otp'           => $otp,
                'code'          => (string) ($promoter['code'] ?? ''),
            ]);
            if (!$mailSent) {
                error_log('promoter approve account mail failed: ' . (Mailer::lastError() ?: 'unknown'));
            }
        } catch (\Throwable $e) {
            error_log('promoter approve account mail exception: ' . $e->getMessage());
        }

        // Fallback: same OTP template used by registration (known-good path).
        if ($otp !== '') {
            try {
                $otpSent = Mailer::send(
                    $toEmail,
                    $toName,
                    'Verify your DanyPathMart promoter account',
                    Mailer::otpEmail($otp, 'registration')
                );
                if (!$otpSent) {
                    error_log('promoter approve OTP mail failed: ' . (Mailer::lastError() ?: 'unknown'));
                } else {
                    $mailSent = true;
                }
            } catch (\Throwable $e) {
                error_log('promoter approve OTP mail exception: ' . $e->getMessage());
            }
        }

        // Plain fallback if HTML templates fail for any reason.
        if (!$mailSent) {
            try {
                $plain = 'Your DanyPathMart promoter account is ready.'
                    . "\nLogin email: {$toEmail}"
                    . "\nTemporary password: {$tempPassword}"
                    . ($otp !== '' ? "\nVerification code: {$otp}" : '')
                    . "\nSign in: " . rtrim((string) Env::get('CORS_ORIGIN', 'https://danypathmart.store'), '/') . '/login';
                $mailSent = Mailer::send(
                    $toEmail,
                    $toName,
                    'Your DanyPathMart promoter login',
                    '<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">'
                        . htmlspecialchars($plain, ENT_QUOTES)
                        . '</pre>',
                    $plain
                );
                if (!$mailSent) {
                    error_log('promoter approve plain mail failed: ' . (Mailer::lastError() ?: 'unknown'));
                }
            } catch (\Throwable $e) {
                error_log('promoter approve plain mail exception: ' . $e->getMessage());
            }
        }

        return [
            'promoter'      => $promoter,
            'temp_password' => $tempPassword,
            'email_sent'    => $mailSent,
            'application'   => self::findById($pdo, $applicationId) ?? $app,
        ];
    }

    public static function reject(PDO $pdo, int $applicationId, int $adminId, ?string $note = null): void
    {
        $app = self::findById($pdo, $applicationId);
        if ($app === null) {
            throw new \InvalidArgumentException('Application not found.');
        }
        if (($app['status'] ?? '') !== 'new') {
            throw new \InvalidArgumentException('This application was already reviewed.');
        }
        $pdo->prepare(
            "UPDATE promoter_applications
             SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
             WHERE id = ?"
        )->execute([$note, $adminId, $applicationId]);
    }

    private static function generateTempPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
        $out = '';
        for ($i = 0; $i < 12; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $out . 'A1';
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        return [
            'id'              => (int) $row['id'],
            'full_name'       => (string) $row['full_name'],
            'email'           => (string) $row['email'],
            'phone'           => $row['phone'] !== null ? (string) $row['phone'] : null,
            'city'            => $row['city'] !== null ? (string) $row['city'] : null,
            'experience'      => $row['experience'] !== null ? (string) $row['experience'] : null,
            'why_join'        => $row['why_join'] !== null ? (string) $row['why_join'] : null,
            'status'          => (string) $row['status'],
            'admin_note'      => $row['admin_note'] !== null ? (string) $row['admin_note'] : null,
            'created_user_id' => $row['created_user_id'] !== null ? (int) $row['created_user_id'] : null,
            'promoter_id'     => $row['promoter_id'] !== null ? (int) $row['promoter_id'] : null,
            'reviewed_by'     => $row['reviewed_by'] !== null ? (int) $row['reviewed_by'] : null,
            'reviewed_at'     => $row['reviewed_at'] ?? null,
            'created_at'      => $row['created_at'] ?? null,
        ];
    }
}
