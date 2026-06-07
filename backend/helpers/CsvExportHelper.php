<?php

declare(strict_types=1);

namespace App\Helpers;

/** Shared CSV column filtering for admin exports. */
final class CsvExportHelper
{
    /**
     * @param list<string> $allColumns
     * @return list<string>
     */
    public static function resolveColumns(array $allColumns, ?string $columnsParam): array
    {
        if ($columnsParam === null || trim($columnsParam) === '') {
            return $allColumns;
        }

        $requested = array_values(array_filter(array_map('trim', explode(',', $columnsParam))));
        if ($requested === []) {
            return $allColumns;
        }

        $allowed = array_flip($allColumns);
        $resolved = [];
        foreach ($requested as $col) {
            if (isset($allowed[$col])) {
                $resolved[] = $col;
            }
        }

        return $resolved !== [] ? $resolved : $allColumns;
    }

    /**
     * @param resource $out
     * @param list<string> $columns
     * @param list<array<string, scalar|null>> $rows
     */
    public static function writeRows($out, array $columns, array $rows): void
    {
        fputcsv($out, $columns);
        foreach ($rows as $row) {
            $line = [];
            foreach ($columns as $col) {
                $line[] = $row[$col] ?? '';
            }
            fputcsv($out, $line);
        }
    }

    public static function beginDownload(string $filename): mixed
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-store');
        echo "\xEF\xBB\xBF";

        $out = fopen('php://output', 'w');
        if ($out === false) {
            exit;
        }

        return $out;
    }

    /**
     * Build CSV string in memory (for email attachments).
     *
     * @param list<string> $columns
     * @param list<array<string, scalar|null>> $rows
     */
    public static function buildString(array $columns, array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        fwrite($handle, "\xEF\xBB\xBF");
        self::writeRows($handle, $columns, $rows);
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return is_string($csv) ? $csv : '';
    }
}
