<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class WeeklyExportService
{
    /**
     * @return array{enabled: bool, email: ?string}
     */
    public static function settings(PDO $pdo): array
    {
        try {
            $row = $pdo->query(
                'SELECT weekly_orders_export_enabled, weekly_orders_export_email FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            if ($row === false) {
                return ['enabled' => false, 'email' => null];
            }

            return [
                'enabled' => (int) ($row['weekly_orders_export_enabled'] ?? 0) === 1,
                'email'   => trim((string) ($row['weekly_orders_export_email'] ?? '')) ?: null,
            ];
        } catch (\Throwable) {
            return ['enabled' => false, 'email' => null];
        }
    }

    /**
     * Send orders CSV for the last N days to the given email.
     *
     * @return array{sent: bool, row_count: int, email: string, message: string}
     */
    public static function sendOrdersCsv(PDO $pdo, string $toEmail, int $days = 7): array
    {
        $toEmail = trim($toEmail);
        if ($toEmail === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
            return ['sent' => false, 'row_count' => 0, 'email' => $toEmail, 'message' => 'Invalid email address.'];
        }

        $since = (new \DateTimeImmutable("-{$days} days"))->format('Y-m-d');
        $result = OrdersCsvBuilder::fetch($pdo, ['since' => $since, 'limit' => 5000]);
        $columns = OrdersCsvBuilder::COLUMNS;
        $csv = CsvExportHelper::buildString($columns, $result['rows']);
        $rowCount = count($result['rows']);
        $filename = 'danypathmart-orders-' . date('Y-m-d') . '.csv';

        $subject = "DanyPathMart orders export — last {$days} days";
        $html = '<p>Attached is your orders CSV export (' . $rowCount . ' row(s), since '
            . htmlspecialchars($since, ENT_QUOTES) . ').</p>'
            . '<p style="color:#666;font-size:13px;">Generated ' . date('Y-m-d H:i') . ' · DanyPathMart admin</p>';

        $sent = Mailer::sendWithCsvAttachment($toEmail, 'DanyPathMart Admin', $subject, $html, $csv, $filename);

        return [
            'sent'      => $sent,
            'row_count' => $rowCount,
            'email'     => $toEmail,
            'message'   => $sent
                ? "Orders CSV emailed to {$toEmail} ({$rowCount} rows)."
                : 'Could not send email. Check SMTP settings.',
        ];
    }

    /** Cron entry: send if enabled and not already sent this calendar week. */
    public static function runScheduled(PDO $pdo): array
    {
        $settings = self::settings($pdo);
        if (!$settings['enabled'] || $settings['email'] === null) {
            return ['skipped' => true, 'message' => 'Weekly export disabled or no email configured.'];
        }

        try {
            $pdo->query('SELECT weekly_orders_export_last_sent FROM company_settings LIMIT 1');
        } catch (\Throwable) {
            return ['skipped' => true, 'message' => 'Run migrate-phase-h.php first.'];
        }

        $row = $pdo->query('SELECT weekly_orders_export_last_sent FROM company_settings ORDER BY id ASC LIMIT 1')->fetch();
        $lastSent = $row['weekly_orders_export_last_sent'] ?? null;
        $weekStart = (new \DateTimeImmutable('monday this week'))->format('Y-m-d 00:00:00');
        if ($lastSent !== null && (string) $lastSent >= $weekStart) {
            return ['skipped' => true, 'message' => 'Already sent this week.'];
        }

        $result = self::sendOrdersCsv($pdo, $settings['email'], 7);
        if ($result['sent']) {
            $pdo->exec('UPDATE company_settings SET weekly_orders_export_last_sent = NOW() WHERE id = 1');
        }

        return array_merge(['skipped' => false], $result);
    }
}
