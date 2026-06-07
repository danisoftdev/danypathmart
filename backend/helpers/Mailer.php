<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;

final class Mailer
{
    public static function send(
        string $toEmail,
        string $toName,
        string $subject,
        string $html,
        string $altText = ''
    ): bool {
        Env::load();
        $host = Env::get('SMTP_HOST');

        // Development fallback: with no SMTP host configured, dump the email
        // to storage/mail so flows remain testable without a mail server.
        if ($host === null) {
            self::devDump($toEmail, $subject, $html);
            return true;
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = Env::int('SMTP_PORT', 587);
            $mail->SMTPAuth = true;
            $mail->Username = (string) Env::get('SMTP_USER', '');
            $mail->Password = (string) Env::get('SMTP_PASS', '');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->CharSet = 'UTF-8';

            $fromEmail = (string) Env::get('SMTP_USER', 'noreply@danypathmart.store');
            $mail->setFrom($fromEmail, (string) Env::get('SMTP_FROM_NAME', 'DanyPathMart'));
            $mail->addAddress($toEmail, $toName);

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;
            $mail->AltBody = $altText !== '' ? $altText : strip_tags($html);

            $mail->send();
            return true;
        } catch (PHPMailerException $e) {
            error_log('Mailer error: ' . $mail->ErrorInfo);
            return false;
        }
    }

    /** Send HTML email with a CSV file attachment. */
    public static function sendWithCsvAttachment(
        string $toEmail,
        string $toName,
        string $subject,
        string $html,
        string $csvContent,
        string $filename = 'export.csv'
    ): bool {
        Env::load();
        $host = Env::get('SMTP_HOST');

        if ($host === null) {
            $dir = dirname(__DIR__) . '/storage/mail';
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $safe = preg_replace('/[^a-z0-9]+/i', '_', $toEmail);
            $base = $dir . '/' . date('Ymd_His') . '_' . $safe;
            @file_put_contents($base . '.html', "<!-- To: {$toEmail} | Subject: {$subject} -->\n" . $html);
            @file_put_contents($base . '_' . $filename, $csvContent);
            return true;
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = Env::int('SMTP_PORT', 587);
            $mail->SMTPAuth = true;
            $mail->Username = (string) Env::get('SMTP_USER', '');
            $mail->Password = (string) Env::get('SMTP_PASS', '');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->CharSet = 'UTF-8';
            $mail->setFrom((string) Env::get('SMTP_USER', 'noreply@danypathmart.store'), (string) Env::get('SMTP_FROM_NAME', 'DanyPathMart'));
            $mail->addAddress($toEmail, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;
            $mail->AltBody = strip_tags($html);
            $mail->addStringAttachment($csvContent, $filename, PHPMailer::ENCODING_BASE64, 'text/csv');
            $mail->send();
            return true;
        } catch (PHPMailerException $e) {
            error_log('Mailer CSV attachment error: ' . $mail->ErrorInfo);
            return false;
        }
    }

    private static function devDump(string $to, string $subject, string $html): void
    {
        $dir = dirname(__DIR__) . '/storage/mail';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $safe = preg_replace('/[^a-z0-9]+/i', '_', $to);
        $file = $dir . '/' . date('Ymd_His') . '_' . $safe . '.html';
        @file_put_contents($file, "<!-- To: {$to} | Subject: {$subject} -->\n" . $html);
    }

    /**
     * Branded OTP email: large gold digits on a dark background.
     */
    public static function otpEmail(string $otp, string $purpose = 'registration'): string
    {
        $heading = match ($purpose) {
            'password_reset' => 'Password Reset Code',
            'email_change'   => 'Confirm Your New Email',
            default          => 'Verify Your Email',
        };
        $intro = match ($purpose) {
            'password_reset' => 'Use the code below to reset your DanyPathMart password.',
            'email_change'   => 'Use the code below to confirm this as your new DanyPathMart email address.',
            default          => 'Welcome to DanyPathMart! Use the code below to verify your email address.',
        };

        $digits = '';
        foreach (str_split($otp) as $d) {
            $digits .= '<span style="display:inline-block;min-width:46px;font-size:34px;'
                . 'font-weight:800;color:#F59E0B;background:#1c1c1c;border-radius:10px;'
                . 'padding:14px 6px;margin:0 5px;letter-spacing:2px;">' . $d . '</span>';
        }

        return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;'
            . 'font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:24px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span>'
            . '</div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:32px 24px;text-align:center;">'
            . '<h1 style="color:#111111;font-size:22px;margin:0 0 12px;">' . $heading . '</h1>'
            . '<p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 24px;">' . $intro . '</p>'
            . '<div style="margin:8px 0 20px;">' . $digits . '</div>'
            . '<p style="color:#888;font-size:13px;margin:0;">This code expires in '
            . OTPService::TTL_MINUTES . ' minutes. If you did not request it, you can ignore this email.</p>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:24px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';
    }

    /**
     * Notify the admin when an image search returns no products. The uploaded
     * image is embedded inline (CID for SMTP, base64 data-URI for the dev dump).
     *
     * @param array{user_label:string,datetime:string,labels:array<int,string>,image_path:?string,link:string} $ctx
     */
    public static function adminImageAlert(string $toEmail, array $ctx): bool
    {
        Env::load();
        $host = Env::get('SMTP_HOST');
        $subject = "Customer searched for a product that does not exist \u{2014} DanyPathMart";

        if ($host === null) {
            $imgTag = '';
            if (!empty($ctx['image_path']) && is_file($ctx['image_path'])) {
                $mime = self::imageMime($ctx['image_path']);
                $b64 = base64_encode((string) file_get_contents($ctx['image_path']));
                $imgTag = '<img src="data:' . $mime . ';base64,' . $b64
                    . '" alt="Search image" style="max-width:280px;border-radius:10px;" />';
            }
            self::devDump($toEmail, $subject, self::imageAlertHtml($ctx, $imgTag));
            return true;
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = Env::int('SMTP_PORT', 587);
            $mail->SMTPAuth = true;
            $mail->Username = (string) Env::get('SMTP_USER', '');
            $mail->Password = (string) Env::get('SMTP_PASS', '');
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->CharSet = 'UTF-8';
            $mail->setFrom((string) Env::get('SMTP_USER', 'noreply@danypathmart.store'), (string) Env::get('SMTP_FROM_NAME', 'DanyPathMart'));
            $mail->addAddress($toEmail, 'DanyPathMart Admin');

            $imgTag = '';
            if (!empty($ctx['image_path']) && is_file($ctx['image_path'])) {
                $mail->addEmbeddedImage($ctx['image_path'], 'searchimg');
                $imgTag = '<img src="cid:searchimg" alt="Search image" style="max-width:280px;border-radius:10px;" />';
            }

            $html = self::imageAlertHtml($ctx, $imgTag);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;
            $mail->AltBody = strip_tags($html);
            $mail->send();
            return true;
        } catch (PHPMailerException $e) {
            error_log('Mailer image-alert error: ' . $mail->ErrorInfo);
            return false;
        }
    }

    /**
     * Welcome email for a newly created staff account with temporary
     * credentials and a first-login security reminder.
     */
    public static function staffWelcome(string $toEmail, string $toName, string $tempPassword, string $loginUrl): bool
    {
        $safeUrl = htmlspecialchars($loginUrl, ENT_QUOTES);
        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;'
            . 'font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:24px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:32px 24px;">'
            . '<h1 style="color:#111;font-size:22px;margin:0 0 12px;">Your staff account is ready</h1>'
            . '<p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 16px;">'
            . 'A DanyPathMart staff account has been created for you. Use the temporary credentials '
            . 'below to log in.</p>'
            . '<div style="background:#fff;border:1px solid #eee;border-radius:10px;padding:16px;margin:0 0 16px;">'
            . '<p style="margin:0 0 6px;color:#111;font-size:14px;"><strong>Login:</strong> '
            . htmlspecialchars($toEmail, ENT_QUOTES) . '</p>'
            . '<p style="margin:0;color:#111;font-size:14px;"><strong>Password:</strong> '
            . '<code style="background:#FFFBF5;padding:2px 6px;border-radius:4px;">'
            . htmlspecialchars($tempPassword, ENT_QUOTES) . '</code></p></div>'
            . '<p style="color:#7c4a03;background:#FEF3C7;border-radius:10px;padding:12px 14px;'
            . 'font-size:13px;margin:0 0 18px;"><strong>Important:</strong> Change your password and '
            . 'set up two-factor authentication (2FA) on your first login.</p>'
            . '<div style="text-align:center;">'
            . '<a href="' . $safeUrl . '" style="display:inline-block;background:#2C7A4B;color:#fff;'
            . 'text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;">Log in</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:24px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';

        return self::send($toEmail, $toName, 'Your DanyPathMart staff account has been created', $html);
    }

    /**
     * Branded password-reset email with a one-hour magic link.
     */
    public static function passwordResetLink(string $toEmail, string $toName, string $link): bool
    {
        $safeLink = htmlspecialchars($link, ENT_QUOTES);
        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;'
            . 'font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:24px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:32px 24px;">'
            . '<h1 style="color:#111;font-size:22px;margin:0 0 12px;">Reset your password</h1>'
            . '<p style="color:#444;font-size:15px;line-height:1.5;margin:0 0 20px;">'
            . 'We received a request to reset your DanyPathMart password. Click the button below to '
            . 'choose a new one. This link expires in 1 hour.</p>'
            . '<div style="text-align:center;margin:0 0 20px;">'
            . '<a href="' . $safeLink . '" style="display:inline-block;background:#2C7A4B;color:#fff;'
            . 'text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;">Reset password</a></div>'
            . '<p style="color:#888;font-size:13px;margin:0 0 6px;">Or paste this link into your browser:</p>'
            . '<p style="word-break:break-all;font-size:12px;color:#2C7A4B;margin:0;">' . $safeLink . '</p>'
            . '<p style="color:#888;font-size:13px;margin:18px 0 0;">If you did not request this, you can '
            . 'safely ignore this email &mdash; your password will not change.</p>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:24px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';

        return self::send($toEmail, $toName, 'Reset your DanyPathMart password', $html);
    }

    /**
     * Branded order confirmation: items table, totals breakdown, pre-order
     * notice and a track-order link.
     *
     * @param array{order:array<string,mixed>,items:array<int,array<string,mixed>>} $ctx
     */
    public static function orderConfirmation(string $toEmail, string $toName, array $ctx): bool
    {
        $subject = 'Order #' . (int) $ctx['order']['id'] . " confirmed \u{2014} DanyPathMart";
        return self::send($toEmail, $toName, $subject, self::orderConfirmationHtml($ctx));
    }

    /**
     * Order status change — sent when admin updates tracking status.
     *
     * @param array{order:array<string,mixed>,items:array<int,array<string,mixed>>,status:string,status_label:string,note:?string,tracking_ref:string} $ctx
     */
    public static function orderStatusUpdate(string $toEmail, string $toName, array $ctx): bool
    {
        $tracking = htmlspecialchars($ctx['tracking_ref'], ENT_QUOTES);
        $subject = "Order {$tracking} update — {$ctx['status_label']}";
        return self::send($toEmail, $toName, $subject, self::orderStatusHtml($ctx));
    }

    public static function customerNotification(
        string $toEmail,
        string $toName,
        string $title,
        string $body,
        ?string $linkUrl = null
    ): bool {
        $safeTitle = htmlspecialchars($title, ENT_QUOTES);
        $safeBody = nl2br(htmlspecialchars($body, ENT_QUOTES));
        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $cta = $linkUrl
            ? '<div style="text-align:center;margin:20px 0 0;">'
                . '<a href="' . htmlspecialchars($appUrl . $linkUrl, ENT_QUOTES) . '" '
                . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
                . 'padding:12px 24px;border-radius:10px;font-weight:700;">View in app</a></div>'
            : '';

        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:20px;margin:0 0 12px;">' . $safeTitle . '</h1>'
            . '<p style="color:#444;font-size:15px;line-height:1.6;margin:0;">' . $safeBody . '</p>'
            . $cta
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';

        return self::send($toEmail, $toName, $safeTitle . ' — DanyPathMart', $html);
    }

    /** Branded admin alert (orders, sign-ins, contact, etc.). */
    public static function adminAlert(
        string $toEmail,
        string $title,
        string $body,
        ?string $linkUrl = null
    ): bool {
        $safeTitle = htmlspecialchars($title, ENT_QUOTES);
        $safeBody = nl2br(htmlspecialchars($body, ENT_QUOTES));
        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $adminLink = $linkUrl
            ? (str_starts_with($linkUrl, 'http') ? $linkUrl : $appUrl . $linkUrl)
            : $appUrl . '/admin/dashboard';
        $cta = '<div style="text-align:center;margin:20px 0 0;">'
            . '<a href="' . htmlspecialchars($adminLink, ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 24px;border-radius:10px;font-weight:700;">Open admin</a></div>';

        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span>'
            . '<p style="color:#888;font-size:12px;margin:8px 0 0;">Admin alert</p></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:20px;margin:0 0 12px;">' . $safeTitle . '</h1>'
            . '<p style="color:#444;font-size:15px;line-height:1.6;margin:0;">' . $safeBody . '</p>'
            . $cta
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'DanyPathMart admin notification</p>'
            . '</div></body></html>';

        return self::send($toEmail, 'DanyPathMart Admin', $safeTitle, $html);
    }

    /**
     * @param array{id:int,name:string,email:string,subject:string,message:string} $ctx
     */
    public static function contactFormToAdmin(string $toEmail, array $ctx): bool
    {
        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $inboxLink = $appUrl . '/admin/contact-inbox';
        $safeName = htmlspecialchars($ctx['name'], ENT_QUOTES);
        $safeEmail = htmlspecialchars($ctx['email'], ENT_QUOTES);
        $safeSubject = htmlspecialchars($ctx['subject'], ENT_QUOTES);
        $safeMessage = nl2br(htmlspecialchars($ctx['message'], ENT_QUOTES));

        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:20px;margin:0 0 12px;">New contact message</h1>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>From:</strong> ' . $safeName . '</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>Email:</strong> '
            . '<a href="mailto:' . $safeEmail . '" style="color:#2C7A4B;">' . $safeEmail . '</a></p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 12px;"><strong>Subject:</strong> ' . $safeSubject . '</p>'
            . '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #eee;">'
            . '<p style="color:#333;font-size:15px;line-height:1.6;margin:0;">' . $safeMessage . '</p></div>'
            . '<div style="text-align:center;margin:20px 0 0;">'
            . '<a href="' . htmlspecialchars($inboxLink, ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 24px;border-radius:10px;font-weight:700;">Open inbox</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'Message #' . (int) $ctx['id'] . ' &middot; DanyPathMart admin</p>'
            . '</div></body></html>';

        return self::send($toEmail, 'DanyPathMart Admin', 'New contact: ' . $ctx['subject'], $html);
    }

    /** @param array{id:int,job_title:string,job_type_label:string,name:string,email:string,phone:string,city:string,cover_message:string,responses?:list<array<string,mixed>>} $ctx */
    public static function careerApplicationToAdmin(string $toEmail, array $ctx): bool
    {
        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $inboxLink = $appUrl . '/admin/career-applications';
        $safeName = htmlspecialchars($ctx['name'], ENT_QUOTES);
        $safeEmail = htmlspecialchars($ctx['email'], ENT_QUOTES);
        $safePhone = htmlspecialchars($ctx['phone'], ENT_QUOTES);
        $safeJob = htmlspecialchars($ctx['job_title'], ENT_QUOTES);
        $safeType = htmlspecialchars($ctx['job_type_label'], ENT_QUOTES);

        $details = '';
        $responses = $ctx['responses'] ?? [];
        if (is_array($responses) && $responses !== []) {
            foreach ($responses as $r) {
                $label = htmlspecialchars((string) ($r['field_label'] ?? 'Field'), ENT_QUOTES);
                if (($r['field_type'] ?? '') === 'file' && !empty($r['file_name'])) {
                    $val = htmlspecialchars((string) $r['file_name'], ENT_QUOTES) . ' (file uploaded)';
                } else {
                    $val = nl2br(htmlspecialchars((string) ($r['value_text'] ?? ''), ENT_QUOTES));
                }
                $details .= '<p style="color:#444;font-size:14px;margin:0 0 8px;"><strong>' . $label . ':</strong> ' . $val . '</p>';
            }
        } else {
            $safeMessage = nl2br(htmlspecialchars($ctx['cover_message'], ENT_QUOTES));
            $details = '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #eee;">'
                . '<p style="color:#333;font-size:15px;line-height:1.6;margin:0;">' . $safeMessage . '</p></div>';
        }

        $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:20px;margin:0 0 12px;">New career application</h1>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>Role:</strong> ' . $safeJob . ' (' . $safeType . ')</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>From:</strong> ' . $safeName . '</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>Email:</strong> '
            . '<a href="mailto:' . $safeEmail . '" style="color:#2C7A4B;">' . $safeEmail . '</a></p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 12px;"><strong>Phone:</strong> ' . $safePhone . '</p>'
            . $details
            . '<div style="text-align:center;margin:20px 0 0;">'
            . '<a href="' . htmlspecialchars($inboxLink, ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 24px;border-radius:10px;font-weight:700;">View applications</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'Application #' . (int) $ctx['id'] . ' &middot; DanyPathMart admin</p>'
            . '</div></body></html>';

        return self::send($toEmail, 'DanyPathMart Admin', 'Career application: ' . $ctx['job_title'], $html);
    }

    /**
     * @param array{order:array<string,mixed>,items:array<int,array<string,mixed>>,status:string,status_label:string,note:?string,tracking_ref:string} $ctx
     */
    private static function orderStatusHtml(array $ctx): string
    {
        $order = $ctx['order'];
        $currency = 'GHS ';
        $money = static fn ($v): string => $currency . number_format((float) $v, 2);
        $tracking = htmlspecialchars($ctx['tracking_ref'], ENT_QUOTES);
        $statusLabel = htmlspecialchars($ctx['status_label'], ENT_QUOTES);
        $note = trim((string) ($ctx['note'] ?? ''));
        $noteBlock = $note !== ''
            ? '<div style="background:#FEF3C7;border-radius:10px;padding:12px 14px;margin:0 0 16px;color:#7c4a03;font-size:13px;">'
                . '<strong>Update:</strong> ' . htmlspecialchars($note, ENT_QUOTES) . '</div>'
            : '';

        $rows = '';
        foreach ($ctx['items'] as $item) {
            $name = htmlspecialchars((string) ($item['name'] ?? 'Product'), ENT_QUOTES);
            $qty = (int) ($item['quantity'] ?? 1);
            $rows .= '<tr>'
                . '<td style="padding:8px 6px;border-bottom:1px solid #eee;color:#222;">' . $name . '</td>'
                . '<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;color:#222;">' . $qty . '</td>'
                . '</tr>';
        }

        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $trackLink = $appUrl . '/dashboard/orders/' . (int) $order['id'];
        $paymentRef = trim((string) ($order['payment_ref'] ?? ''));
        $refLine = $paymentRef !== ''
            ? '<p style="color:#444;font-size:13px;margin:0 0 8px;"><strong>Payment ref:</strong> '
                . htmlspecialchars($paymentRef, ENT_QUOTES) . '</p>'
            : '';

        return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:600px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:22px;margin:0 0 6px;">' . $statusLabel . '</h1>'
            . '<p style="color:#444;font-size:14px;margin:0 0 4px;">Tracking reference: <strong>' . $tracking . '</strong></p>'
            . $refLine
            . $noteBlock
            . '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">'
            . '<thead><tr>'
            . '<th style="text-align:left;padding:6px;border-bottom:2px solid #2C7A4B;color:#2C7A4B;">Item</th>'
            . '<th style="text-align:center;padding:6px;border-bottom:2px solid #2C7A4B;color:#2C7A4B;">Qty</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>'
            . '<p style="color:#111;font-size:15px;font-weight:700;margin:0 0 16px;">Order total: ' . $money($order['total']) . '</p>'
            . '<div style="text-align:center;">'
            . '<a href="' . htmlspecialchars($trackLink, ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 24px;border-radius:10px;font-weight:700;">View order details</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';
    }

    /**
     * @param array{order:array<string,mixed>,items:array<int,array<string,mixed>>} $ctx
     */
    private static function orderConfirmationHtml(array $ctx): string
    {
        $order = $ctx['order'];
        $currency = 'GHS ';
        $money = static fn ($v): string => $currency . number_format((float) $v, 2);

        $rows = '';
        $hasPreorder = false;
        foreach ($ctx['items'] as $item) {
            $isPre = (int) ($item['is_preorder'] ?? 0) === 1;
            $hasPreorder = $hasPreorder || $isPre;
            $name = htmlspecialchars((string) ($item['name'] ?? 'Product'), ENT_QUOTES);
            $badge = $isPre
                ? ' <span style="background:#F59E0B;color:#000;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700;">BY AIR</span>'
                : '';
            $lineTotal = (float) $item['unit_price'] * (int) $item['quantity'];
            $rows .= '<tr>'
                . '<td style="padding:8px 6px;border-bottom:1px solid #eee;color:#222;">' . $name . $badge . '</td>'
                . '<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;color:#222;">' . (int) $item['quantity'] . '</td>'
                . '<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;color:#222;">' . $money($lineTotal) . '</td>'
                . '</tr>';
        }

        $preNotice = $hasPreorder
            ? '<div style="background:#FEF3C7;border-radius:10px;padding:12px 14px;margin:0 0 16px;color:#7c4a03;font-size:13px;">'
                . 'Your order includes items shipped by air from overseas. Estimated arrival times are shown in your account.'
                . '</div>'
            : '';

        $appUrl = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $trackLink = $appUrl . '/order/' . (int) $order['id'];

        $totals = ''
            . self::totalRow('Subtotal', $money($order['subtotal']))
            . self::totalRow('International shipping', $money($order['intl_shipping_cost']))
            . self::totalRow('Local delivery (' . number_format((float) $order['local_delivery_percent'], 2) . '%)', $money($order['local_delivery_cost']))
            . self::totalRow('Total paid', $money($order['total']), true);

        return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;'
            . 'font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:600px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:22px;margin:0 0 6px;">Thank you for your order!</h1>'
            . '<p style="color:#444;font-size:14px;margin:0 0 16px;">Order <strong>#' . (int) $order['id'] . '</strong> is confirmed and now processing.</p>'
            . $preNotice
            . '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">'
            . '<thead><tr>'
            . '<th style="text-align:left;padding:6px;border-bottom:2px solid #2C7A4B;color:#2C7A4B;">Item</th>'
            . '<th style="text-align:center;padding:6px;border-bottom:2px solid #2C7A4B;color:#2C7A4B;">Qty</th>'
            . '<th style="text-align:right;padding:6px;border-bottom:2px solid #2C7A4B;color:#2C7A4B;">Total</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody></table>'
            . '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px;">' . $totals . '</table>'
            . '<div style="text-align:center;">'
            . '<a href="' . htmlspecialchars($trackLink, ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 24px;border-radius:10px;font-weight:700;">Track your order</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.store</p>'
            . '</div></body></html>';
    }

    private static function totalRow(string $label, string $value, bool $bold = false): string
    {
        $weight = $bold ? '700' : '400';
        $border = $bold ? 'border-top:2px solid #2C7A4B;' : 'border-top:1px solid #eee;';
        return '<tr>'
            . '<td style="padding:6px;color:#444;font-weight:' . $weight . ';' . $border . '">' . htmlspecialchars($label, ENT_QUOTES) . '</td>'
            . '<td style="padding:6px;text-align:right;color:#111;font-weight:' . $weight . ';' . $border . '">' . $value . '</td>'
            . '</tr>';
    }

    private static function imageMime(string $path): string
    {
        if (function_exists('mime_content_type')) {
            $mime = @mime_content_type($path);
            if (is_string($mime) && $mime !== '') {
                return $mime;
            }
        }
        return 'image/jpeg';
    }

    /**
     * @param array{user_label:string,datetime:string,labels:array<int,string>,image_path:?string,link:string} $ctx
     */
    private static function imageAlertHtml(array $ctx, string $imgTag): string
    {
        $labels = '';
        foreach ($ctx['labels'] as $label) {
            $labels .= '<span style="display:inline-block;background:#2C7A4B;color:#fff;'
                . 'border-radius:999px;padding:4px 10px;margin:2px;font-size:13px;">'
                . htmlspecialchars($label, ENT_QUOTES) . '</span>';
        }
        if ($labels === '') {
            $labels = '<em style="color:#888;">No labels detected.</em>';
        }

        return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#111111;'
            . 'font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">'
            . '<div style="text-align:center;margin-bottom:20px;">'
            . '<span style="font-size:24px;font-weight:800;color:#2C7A4B;">DanyPath</span>'
            . '<span style="font-size:24px;font-weight:800;color:#F59E0B;">Mart</span></div>'
            . '<div style="background:#FFFBF5;border-radius:16px;padding:28px 24px;">'
            . '<h1 style="color:#111;font-size:20px;margin:0 0 8px;">Product not found in catalogue</h1>'
            . '<p style="color:#444;font-size:14px;margin:0 0 16px;">A customer searched by image but no '
            . 'matching products were found. Consider sourcing this item.</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 4px;"><strong>Customer:</strong> '
            . htmlspecialchars($ctx['user_label'], ENT_QUOTES) . '</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 12px;"><strong>When:</strong> '
            . htmlspecialchars($ctx['datetime'], ENT_QUOTES) . '</p>'
            . '<p style="color:#444;font-size:14px;margin:0 0 6px;"><strong>Detected labels:</strong></p>'
            . '<div style="margin:0 0 16px;">' . $labels . '</div>'
            . '<div style="text-align:center;margin:0 0 16px;">' . $imgTag . '</div>'
            . '<div style="text-align:center;">'
            . '<a href="' . htmlspecialchars($ctx['link'], ENT_QUOTES) . '" '
            . 'style="display:inline-block;background:#2C7A4B;color:#fff;text-decoration:none;'
            . 'padding:12px 22px;border-radius:10px;font-weight:700;">Review alert</a></div>'
            . '</div>'
            . '<p style="text-align:center;color:#666;font-size:12px;margin-top:20px;">'
            . 'DanyPathMart admin notification</p>'
            . '</div></body></html>';
    }
}
