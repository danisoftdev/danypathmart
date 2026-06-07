<?php



declare(strict_types=1);



namespace App\Helpers;



use PDO;



final class OpsSettings

{

    /** @return array{analytics_enabled:bool,google_analytics_id:?string,uptime_monitor_url:?string} */

    public static function load(PDO $pdo): array

    {

        $defaults = [

            'analytics_enabled'    => false,

            'google_analytics_id'  => null,

            'uptime_monitor_url'   => null,

        ];



        try {

            $row = $pdo->query(

                'SELECT analytics_enabled, google_analytics_id, uptime_monitor_url

                 FROM company_settings ORDER BY id ASC LIMIT 1'

            )->fetch();

        } catch (\Throwable) {

            return $defaults;

        }



        if ($row === false) {

            return $defaults;

        }



        $gaId = trim((string) ($row['google_analytics_id'] ?? ''));



        return [

            'analytics_enabled'   => (int) ($row['analytics_enabled'] ?? 0) === 1,

            'google_analytics_id' => $gaId !== '' ? $gaId : null,

            'uptime_monitor_url'  => self::nullableUrl($row['uptime_monitor_url'] ?? null),

        ];

    }



    public static function isValidMeasurementId(?string $id): bool

    {

        if ($id === null || $id === '') {

            return false;

        }



        return (bool) preg_match('/^(G-[A-Z0-9]{6,12}|UA-\d+-\d+)$/i', trim($id));

    }



    private static function nullableUrl(mixed $value): ?string

    {

        $v = trim((string) ($value ?? ''));

        if ($v === '') {

            return null;

        }

        if (!filter_var($v, FILTER_VALIDATE_URL)) {

            return null;

        }



        return $v;

    }

}

