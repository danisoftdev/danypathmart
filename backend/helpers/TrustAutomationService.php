<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Optional auto-actions when trust rules are enabled (permission-gated at admin). */
final class TrustAutomationService
{
    /** @return array{enabled:bool,cautions_threshold:int,restrict_threshold:int} */
    public static function settings(PDO $pdo): array
    {
        $defaults = ['enabled' => false, 'cautions_threshold' => 3, 'restrict_threshold' => 3];

        try {
            $row = $pdo->query(
                'SELECT trust_automation_enabled, trust_auto_cautions_threshold, trust_auto_restrict_threshold
                 FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        return [
            'enabled'             => (int) ($row['trust_automation_enabled'] ?? 0) === 1,
            'cautions_threshold'  => max(1, (int) ($row['trust_auto_cautions_threshold'] ?? 3)),
            'restrict_threshold'  => max(1, (int) ($row['trust_auto_restrict_threshold'] ?? 3)),
        ];
    }

    public static function onReportCreated(PDO $pdo, int $shopId, int $reportId): void
    {
        $cfg = self::settings($pdo);
        if (!$cfg['enabled']) {
            return;
        }

        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM shop_reports
             WHERE shop_id = ? AND status IN ('open', 'under_review')
               AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
        $stmt->execute([$shopId]);
        $openCount = (int) $stmt->fetchColumn();

        if ($openCount < $cfg['cautions_threshold']) {
            return;
        }

        $ownerStmt = $pdo->prepare(
            "SELECT u.id FROM shop_members sm INNER JOIN users u ON u.id = sm.user_id
             WHERE sm.shop_id = ? AND sm.role = 'owner' LIMIT 1"
        );
        $ownerStmt->execute([$shopId]);
        $ownerId = (int) ($ownerStmt->fetchColumn() ?: 0);
        if ($ownerId <= 0) {
            return;
        }

        $level = $openCount >= $cfg['restrict_threshold'] ? 'restriction' : 'caution';
        $message = $level === 'restriction'
            ? 'Your shop has multiple open customer reports. Order acceptance is restricted until we review your account.'
            : 'Your shop has received several customer reports. Please resolve outstanding issues or contact support.';

        UserCautionService::issue(
            $pdo,
            $ownerId,
            0,
            $level,
            $message,
            'Auto-generated from trust automation (open reports threshold).',
            $reportId
        );
    }
}
