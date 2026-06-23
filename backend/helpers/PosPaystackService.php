<?php

declare(strict_types=1);

namespace App\Helpers;

use App\Config\Env;
use PDO;
use RuntimeException;

final class PosPaystackService
{
    /** @return array<string,mixed> */
    public static function initialize(PDO $pdo, int $orderId, string $email, float $totalGhs): array
    {
        $amount = (int) round($totalGhs * 100);
        if ($amount <= 0) {
            throw new RuntimeException('Invalid amount.');
        }

        $secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
        $configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');

        if (!$configured) {
            $ref = 'POS-DEV-' . bin2hex(random_bytes(6));
            self::recordPending($pdo, $orderId, $ref, $totalGhs);
            return [
                'dev_mock'          => true,
                'reference'         => $ref,
                'authorization_url' => null,
                'access_code'       => null,
                'public_key'        => Env::get('PAYSTACK_PUBLIC_KEY'),
            ];
        }

        $frontend = rtrim((string) Env::get('CORS_ORIGIN', 'http://localhost:5173'), '/');
        $payload = json_encode([
            'email'        => $email,
            'amount'       => $amount,
            'currency'     => 'GHS',
            'channels'     => ['card', 'mobile_money'],
            'callback_url' => $frontend . '/pos?paystack=1',
            'metadata'     => [
                'order_id' => $orderId,
                'channel'  => 'pos',
            ],
        ]);

        $ch = curl_init('https://api.paystack.co/transaction/initialize');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $secret,
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            throw new RuntimeException('Could not reach Paystack.');
        }

        $data = json_decode((string) $response, true);
        if ($httpCode >= 400 || !is_array($data) || empty($data['status']) || empty($data['data']['reference'])) {
            $msg = is_array($data) && isset($data['message']) ? (string) $data['message'] : 'Paystack init failed.';
            throw new RuntimeException($msg);
        }

        $ref = (string) $data['data']['reference'];
        self::recordPending($pdo, $orderId, $ref, $totalGhs);

        return [
            'dev_mock'          => false,
            'reference'         => $ref,
            'access_code'       => $data['data']['access_code'] ?? null,
            'authorization_url' => $data['data']['authorization_url'] ?? null,
            'public_key'        => Env::get('PAYSTACK_PUBLIC_KEY'),
        ];
    }

    public static function verifyAndMarkPaid(PDO $pdo, int $orderId, string $reference): void
    {
        $secret = (string) Env::get('PAYSTACK_SECRET_KEY', '');
        $configured = $secret !== '' && !str_contains($secret, 'xxxx') && str_starts_with($secret, 'sk_');

        if (!$configured || str_starts_with($reference, 'POS-DEV-')) {
            $pdo->prepare(
                "INSERT INTO payments (order_id, paystack_ref, amount, status)
                 VALUES (?, ?, (SELECT total FROM orders WHERE id = ?), 'success')
                 ON DUPLICATE KEY UPDATE status = 'success'"
            )->execute([$orderId, $reference, $orderId]);
            return;
        }

        $ch = curl_init('https://api.paystack.co/transaction/verify/' . rawurlencode($reference));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $secret],
            CURLOPT_TIMEOUT        => 20,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode >= 400) {
            throw new RuntimeException('Could not verify Paystack payment.');
        }

        $data = json_decode((string) $response, true);
        $status = $data['data']['status'] ?? '';
        if (!is_array($data) || empty($data['status']) || $status !== 'success') {
            throw new RuntimeException('Payment was not successful.');
        }

        $amount = round(((int) ($data['data']['amount'] ?? 0)) / 100, 2);
        $pdo->prepare(
            "INSERT INTO payments (order_id, paystack_ref, amount, status)
             VALUES (?, ?, ?, 'success')
             ON DUPLICATE KEY UPDATE amount = VALUES(amount), status = 'success'"
        )->execute([$orderId, $reference, $amount]);
    }

    private static function recordPending(PDO $pdo, int $orderId, string $ref, float $amount): void
    {
        $pdo->prepare('UPDATE orders SET payment_ref = ? WHERE id = ?')->execute([$ref, $orderId]);
        $pdo->prepare(
            "INSERT INTO payments (order_id, paystack_ref, amount, status)
             VALUES (?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE amount = VALUES(amount)"
        )->execute([$orderId, $ref, $amount]);
    }
}
