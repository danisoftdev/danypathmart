<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class PosReceiptService
{
    /** @return array<string,mixed> */
    public static function build(PDO $pdo, int $orderId): array
    {
        $sale = PosSaleService::find($pdo, $orderId);
        if ($sale === null) {
            throw new \RuntimeException('Sale not found.');
        }
        $settings = PosSettingsService::load($pdo);

        return [
            'company_name'    => $settings['company_name'],
            'footer'          => $settings['pos_receipt_footer'],
            'sale'            => $sale,
            'printed_at'      => date('Y-m-d H:i:s'),
        ];
    }

    /** @return array{ok:bool,error:?string} */
    public static function sendSms(PDO $pdo, int $orderId, ?string $phoneOverride = null): array
    {
        $sale = PosSaleService::find($pdo, $orderId);
        if ($sale === null) {
            return ['ok' => false, 'error' => 'Sale not found.'];
        }

        $phone = $phoneOverride ?? ($sale['customer_phone'] ?? null);
        if ($phone === null || trim($phone) === '') {
            return ['ok' => false, 'error' => 'No phone number for receipt.'];
        }

        $settings = PosSettingsService::load($pdo);
        $ref = $sale['tracking_ref'] ?? ('#' . $orderId);
        $loc = $sale['location']['name'] ?? 'DanyPathMart';
        $message = $settings['company_name'] . ' — Receipt ' . $ref . '. Total '
            . number_format((float) $sale['total'], 2) . ' GHS. Collected at ' . $loc . '. Thank you!';

        return MessagingIntegrationService::sendSms($pdo, trim($phone), $message, 'Receipt');
    }
}
