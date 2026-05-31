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
        $key = (string) Env::get('GOOGLE_VISION_API_KEY', '');
        return $key !== '' && !str_contains($key, 'xxxx');
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

        $url = self::ENDPOINT . '?key=' . urlencode((string) Env::get('GOOGLE_VISION_API_KEY', ''));
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
}
