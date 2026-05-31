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

            $fromEmail = (string) Env::get('SMTP_USER', 'noreply@danypathmart.com');
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
        $heading = $purpose === 'password_reset' ? 'Password Reset Code' : 'Verify Your Email';
        $intro = $purpose === 'password_reset'
            ? 'Use the code below to reset your DanyPathMart password.'
            : 'Welcome to DanyPathMart! Use the code below to verify your email address.';

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
            . 'Developed &amp; Owned by danysoftdev &middot; danypathmart.com</p>'
            . '</div></body></html>';
    }
}
