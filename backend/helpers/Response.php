<?php

declare(strict_types=1);

namespace App\Helpers;

final class Response
{
    /**
     * @param array<string,mixed> $data
     */
    public static function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function success(array $data = [], int $status = 200): never
    {
        self::json(['success' => true] + $data, $status);
    }

    /**
     * @param array<string,mixed> $extra
     */
    public static function error(string $message, int $status = 400, array $extra = []): never
    {
        self::json(['success' => false, 'message' => $message] + $extra, $status);
    }

    /**
     * Decode the JSON request body into an array.
     *
     * @return array<string,mixed>
     */
    public static function body(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return $_POST;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
