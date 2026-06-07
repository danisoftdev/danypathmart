<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class HrSettings
{
    /** @return array{leave_requests_enabled:bool,default_annual_leave_days:int} */
    public static function load(PDO $pdo): array
    {
        $defaults = [
            'leave_requests_enabled'    => false,
            'default_annual_leave_days' => 21,
        ];

        try {
            $row = $pdo->query(
                'SELECT leave_requests_enabled, default_annual_leave_days FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
        } catch (\Throwable) {
            return $defaults;
        }

        if ($row === false) {
            return $defaults;
        }

        return [
            'leave_requests_enabled'    => (int) ($row['leave_requests_enabled'] ?? 0) === 1,
            'default_annual_leave_days' => max(1, (int) ($row['default_annual_leave_days'] ?? 21)),
        ];
    }
}
