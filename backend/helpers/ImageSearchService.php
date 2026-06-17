<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;

/**
 * Google Cloud Vision REST integration for image-based product search.
 */
final class ImageSearchService
{
    private const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
    private const MIN_SCORE = 0.70;

    public static function isConfigured(): bool
    {
        $key = trim((string) Env::get('GOOGLE_VISION_API_KEY', ''));
        return $key !== '' && !str_contains($key, 'xxxx');
    }

    private static function apiKey(): string
    {
        return trim((string) Env::get('GOOGLE_VISION_API_KEY', ''));
    }

    /** Company toggle from admin (requires migration 050). */
    public static function isStoreEnabled(\PDO $pdo): bool
    {
        try {
            $row = $pdo->query(
                'SELECT image_search_enabled FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetch();
            return $row !== false && (int) ($row['image_search_enabled'] ?? 0) === 1;
        } catch (\Throwable) {
            return false;
        }
    }

    /** Store toggle on and Vision API key configured in .env. */
    public static function isAvailable(\PDO $pdo): bool
    {
        return self::isStoreEnabled($pdo) && self::isConfigured();
    }

    /**
     * Detect labels/objects in an image. Returns a de-duplicated list of
     * lower-cased description strings with score >= 0.70. Returns an empty
     * array if Vision is not configured or the call fails (caller then treats
     * the search as "no match" and raises an admin alert).
     *
     * @return array<int,string>
     */
    public static function detectLabels(string $imagePath): array
    {
        if (!self::isConfigured() || !is_file($imagePath)) {
            return [];
        }

        $content = base64_encode((string) file_get_contents($imagePath));
        $payload = [
            'requests' => [[
                'image'    => ['content' => $content],
                'features' => [
                    ['type' => 'LABEL_DETECTION', 'maxResults' => 10],
                    ['type' => 'OBJECT_LOCALIZATION', 'maxResults' => 5],
                ],
            ]],
        ];

        $url = self::ENDPOINT . '?key=' . urlencode(self::apiKey());
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $status !== 200) {
            error_log('Vision API error (' . $status . '): ' . $error . ' ' . (string) $response);
            return [];
        }

        $data = json_decode((string) $response, true);
        $annotations = $data['responses'][0] ?? [];

        $labels = [];
        foreach (($annotations['labelAnnotations'] ?? []) as $a) {
            if (($a['score'] ?? 0) >= self::MIN_SCORE && !empty($a['description'])) {
                $labels[] = strtolower(trim((string) $a['description']));
            }
        }
        foreach (($annotations['localizedObjectAnnotations'] ?? []) as $a) {
            if (($a['score'] ?? 0) >= self::MIN_SCORE && !empty($a['name'])) {
                $labels[] = strtolower(trim((string) $a['name']));
            }
        }

        return array_values(array_unique($labels));
    }

    /**
     * Diagnostic probe for CLI tests — returns HTTP status and API error text.
     *
     * @return array{ok:bool,http:int,error:string,labels:array<int,string>,image:string}
     */
    public static function probe(string $imagePath): array
    {
        $result = [
            'ok'     => false,
            'http'   => 0,
            'error'  => '',
            'labels' => [],
            'image'  => $imagePath,
        ];

        if (!self::isConfigured()) {
            $result['error'] = 'GOOGLE_VISION_API_KEY not configured';
            return $result;
        }
        if (!is_file($imagePath)) {
            $result['error'] = 'Image file not found';
            return $result;
        }

        $content = base64_encode((string) file_get_contents($imagePath));
        $payload = [
            'requests' => [[
                'image'    => ['content' => $content],
                'features' => [
                    ['type' => 'LABEL_DETECTION', 'maxResults' => 10],
                    ['type' => 'OBJECT_LOCALIZATION', 'maxResults' => 5],
                ],
            ]],
        ];

        $url = self::ENDPOINT . '?key=' . urlencode(self::apiKey());
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $result['http'] = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            $result['error'] = $curlErr !== '' ? $curlErr : 'curl request failed';
            return $result;
        }

        $data = json_decode((string) $response, true);
        if ($result['http'] !== 200) {
            $apiMsg = $data['error']['message'] ?? substr((string) $response, 0, 240);
            $result['error'] = 'HTTP ' . $result['http'] . ': ' . $apiMsg;
            return $result;
        }

        $annotations = $data['responses'][0] ?? [];
        if (!empty($annotations['error']['message'])) {
            $result['error'] = (string) $annotations['error']['message'];
            return $result;
        }

        $labels = [];
        foreach (($annotations['labelAnnotations'] ?? []) as $a) {
            if (($a['score'] ?? 0) >= self::MIN_SCORE && !empty($a['description'])) {
                $labels[] = strtolower(trim((string) $a['description']));
            }
        }
        foreach (($annotations['localizedObjectAnnotations'] ?? []) as $a) {
            if (($a['score'] ?? 0) >= self::MIN_SCORE && !empty($a['name'])) {
                $labels[] = strtolower(trim((string) $a['name']));
            }
        }
        $result['labels'] = array_values(array_unique($labels));
        if ($result['labels'] === []) {
            $preview = [];
            foreach (($annotations['labelAnnotations'] ?? []) as $a) {
                if (!empty($a['description'])) {
                    $preview[] = ($a['description'] ?? '') . '(' . round((float) ($a['score'] ?? 0), 2) . ')';
                }
                if (count($preview) >= 5) {
                    break;
                }
            }
            $hint = $preview !== [] ? ' Raw labels: ' . implode(', ', $preview) : ' No labelAnnotations in response';
            $result['error'] = 'API OK but no labels above score threshold (0.70).' . $hint;
        } else {
            $result['ok'] = true;
        }

        return $result;
    }
}
