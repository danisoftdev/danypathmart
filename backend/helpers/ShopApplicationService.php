<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Shop onboarding applications (Phase M4). */
final class ShopApplicationService
{
    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function submit(PDO $pdo, array $input, ?int $userId = null): array
    {
        if (!PlatformFeatures::load($pdo)['marketplace_enabled']) {
            throw new \InvalidArgumentException('Marketplace is not open yet.');
        }
        if (!PlatformFeatures::load($pdo)['shop_applications_open']) {
            throw new \InvalidArgumentException('Shop applications are closed.');
        }

        $businessName = trim((string) ($input['business_name'] ?? ''));
        $contactName = trim((string) ($input['contact_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));

        if ($businessName === '' || $contactName === '' || $email === '' || $phone === '' || $city === '') {
            throw new \InvalidArgumentException('Please fill in all required fields.');
        }

        if ($userId !== null) {
            $existingShop = ShopService::userShopId($pdo, $userId);
            if ($existingShop !== null) {
                throw new \InvalidArgumentException('You already have a shop on DanyPathMart.');
            }
        }

        $logoUrl = self::nullable($input['logo_url'] ?? null);
        $referredCode = self::nullable($input['referred_by_shop_code'] ?? $input['referral_code'] ?? null);
        $referrerType = null;
        $referrerShopId = null;
        $referrerPromoterId = null;

        if ($referredCode !== null && SubscriptionReferralService::settings($pdo)['enabled']) {
            $resolved = SubscriptionReferralService::resolveReferrer($pdo, $referredCode);
            if ($resolved === null) {
                throw new \InvalidArgumentException('Referral code was not found. Check the code and try again.');
            }
            $referrerType = $resolved['type'];
            if ($referrerType === 'shop') {
                $referrerShopId = $resolved['id'];
            } else {
                $referrerPromoterId = $resolved['id'];
            }
            $referredCode = $resolved['code'];
        }

        try {
            $coords = LocationHelper::parseLatLng($input);
            $pdo->prepare(
                'INSERT INTO shop_applications
                    (user_id, business_name, contact_name, email, phone, city, street_address, region,
                     latitude, longitude, allows_shop_pickup, description, logo_url,
                     referred_by_shop_code, referred_by_shop_id, referred_by_type, referred_by_promoter_id,
                     bank_name, bank_account_name, bank_account_number, momo_number)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $businessName,
                $contactName,
                $email,
                $phone,
                $city,
                self::nullable($input['street_address'] ?? null),
                self::nullable($input['region'] ?? null),
                $coords['latitude'],
                $coords['longitude'],
                !empty($input['allows_shop_pickup']) ? 1 : 0,
                self::nullable($input['description'] ?? null),
                $logoUrl,
                $referredCode,
                $referrerShopId,
                $referrerType,
                $referrerPromoterId,
                self::nullable($input['bank_name'] ?? null),
                self::nullable($input['bank_account_name'] ?? null),
                self::nullable($input['bank_account_number'] ?? null),
                self::nullable($input['momo_number'] ?? null),
            ]);
        } catch (\Throwable) {
            $pdo->prepare(
                'INSERT INTO shop_applications
                    (user_id, business_name, contact_name, email, phone, city, description,
                     bank_name, bank_account_name, bank_account_number, momo_number)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $businessName,
                $contactName,
                $email,
                $phone,
                $city,
                self::nullable($input['description'] ?? null),
                self::nullable($input['bank_name'] ?? null),
                self::nullable($input['bank_account_name'] ?? null),
                self::nullable($input['bank_account_number'] ?? null),
                self::nullable($input['momo_number'] ?? null),
            ]);
        }

        $id = (int) $pdo->lastInsertId();

        $initial = ShopBillingService::initialApplicationStatus($pdo, [
            'user_id'            => $userId,
            'email'              => $email,
            'has_valid_referrer' => $referrerType !== null,
        ]);
        if ($initial['status'] !== 'new') {
            $pdo->prepare('UPDATE shop_applications SET status = ? WHERE id = ?')
                ->execute([$initial['status'], $id]);
        }

        ShopBillingService::applyRegistrationPricingToApplication($pdo, $id);

        $result = self::findById($pdo, $id) ?? [];
        $result['requires_payment'] = ShopBillingService::registrationRequired($pdo, $result);

        return $result;
    }

    /** @return list<array<string,mixed>> */
    public static function list(PDO $pdo, ?string $status = null): array
    {
        $sql = 'SELECT a.*, u.name AS user_name FROM shop_applications a LEFT JOIN users u ON u.id = a.user_id';
        $params = [];
        if ($status !== null && $status !== '') {
            $sql .= ' WHERE a.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY a.created_at DESC LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return array_map([self::class, 'formatRow'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT a.*, u.name AS user_name FROM shop_applications a
             LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRow($row);
    }

    public static function approve(PDO $pdo, int $applicationId, ?int $adminUserId = null, ?string $note = null): array
    {
        $app = self::findById($pdo, $applicationId);
        if ($app === null) {
            throw new \InvalidArgumentException('Application not found.');
        }
        if (!in_array($app['status'], ['new', 'pending_payment'], true)) {
            throw new \InvalidArgumentException('Application already reviewed.');
        }
        if ($app['status'] === 'pending_payment') {
            throw new \InvalidArgumentException('Registration fee must be paid or waived before approval.');
        }

        if (ShopBillingService::registrationRequired($pdo, $app)) {
            throw new \InvalidArgumentException('Registration fee must be paid or waived before approval.');
        }

        $pdo->beginTransaction();
        try {
            $shop = ShopService::create($pdo, [
                'name'                => $app['business_name'],
                'logo_url'            => $app['logo_url'] ?? null,
                'contact_email'       => $app['email'],
                'contact_phone'       => $app['phone'],
                'city'                => $app['city'],
                'street_address'      => $app['street_address'] ?? null,
                'region'              => $app['region'] ?? null,
                'latitude'            => $app['latitude'] ?? null,
                'longitude'           => $app['longitude'] ?? null,
                'allows_shop_pickup'  => !empty($app['allows_shop_pickup']),
                'description'         => $app['description'],
                'bank_name'           => $app['bank_name'],
                'bank_account_name'   => $app['bank_account_name'],
                'bank_account_number' => $app['bank_account_number'],
                'momo_number'         => $app['momo_number'],
                'status'              => 'active',
                'is_published'        => true,
            ]);

            $ownerId = $app['user_id'];
            if ($ownerId === null) {
                $userStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
                $userStmt->execute([$app['email']]);
                $ownerId = $userStmt->fetchColumn();
                $ownerId = $ownerId !== false ? (int) $ownerId : null;
            }
            if ($ownerId !== null) {
                ShopService::addOwner($pdo, (int) $shop['id'], $ownerId);
            }

            $referrerShopId = $app['referred_by_shop_id'] ?? null;
            if ($referrerShopId === null && ($app['referred_by_type'] ?? '') === 'shop' && !empty($app['referred_by_shop_code'])) {
                $referrerShopId = ShopReferralService::resolveReferrerId($pdo, (string) $app['referred_by_shop_code']);
            }
            if ($referrerShopId !== null) {
                ShopReferralService::registerReferredShop($pdo, (int) $shop['id'], (int) $referrerShopId);
            }
            ShopReferralService::ensureReferralCode($pdo, (int) $shop['id']);

            $pdo->prepare(
                'UPDATE shop_applications SET status = ?, shop_id = ?, admin_note = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?'
            )->execute(['approved', $shop['id'], $note, $adminUserId, $applicationId]);

            ShopBillingService::createSubscriptionOnApprove($pdo, (int) $shop['id']);
            $pdo->prepare('UPDATE shops SET verified_at = COALESCE(verified_at, NOW()) WHERE id = ?')
                ->execute([(int) $shop['id']]);
            SubscriptionReferralService::releaseOnApprove($pdo, $applicationId);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ShopService::findById($pdo, (int) ($shop['id'] ?? 0)) ?? [];
    }

    public static function reject(PDO $pdo, int $applicationId, ?string $note = null): void
    {
        $app = self::findById($pdo, $applicationId);
        if ($app === null) {
            throw new \InvalidArgumentException('Application not found.');
        }
        if (!in_array($app['status'], ['new', 'pending_payment'], true)) {
            throw new \InvalidArgumentException('Application already reviewed.');
        }

        $pdo->prepare(
            'UPDATE shop_applications SET status = ?, admin_note = ?, reviewed_at = NOW() WHERE id = ?'
        )->execute(['rejected', $note, $applicationId]);

        SubscriptionReferralService::reverseOnReject($pdo, $applicationId);
    }

    private static function nullable(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    /** @param array<string,mixed> $row */
    private static function formatRow(array $row): array
    {
        return [
            'id'                  => (int) $row['id'],
            'user_id'             => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'user_name'           => $row['user_name'] ?? null,
            'business_name'       => $row['business_name'],
            'contact_name'        => $row['contact_name'],
            'email'               => $row['email'],
            'phone'               => $row['phone'],
            'city'                => $row['city'],
            'street_address'      => $row['street_address'] ?? null,
            'region'              => $row['region'] ?? null,
            'latitude'            => isset($row['latitude']) && $row['latitude'] !== null ? (float) $row['latitude'] : null,
            'longitude'           => isset($row['longitude']) && $row['longitude'] !== null ? (float) $row['longitude'] : null,
            'allows_shop_pickup'  => !empty($row['allows_shop_pickup'] ?? null),
            'description'         => $row['description'],
            'logo_url'            => $row['logo_url'] ?? null,
            'referred_by_shop_code' => $row['referred_by_shop_code'] ?? null,
            'referred_by_shop_id'   => isset($row['referred_by_shop_id']) && $row['referred_by_shop_id'] !== null
                ? (int) $row['referred_by_shop_id'] : null,
            'referred_by_type'      => $row['referred_by_type'] ?? null,
            'referred_by_promoter_id' => isset($row['referred_by_promoter_id']) && $row['referred_by_promoter_id'] !== null
                ? (int) $row['referred_by_promoter_id'] : null,
            'referral_commission_paid' => !empty($row['referral_commission_paid'] ?? null),
            'bank_name'           => $row['bank_name'],
            'bank_account_name'   => $row['bank_account_name'],
            'bank_account_number' => $row['bank_account_number'],
            'momo_number'         => $row['momo_number'],
            'status'              => $row['status'],
            'registration_fee_paid'   => !empty($row['registration_fee_paid'] ?? null),
            'registration_fee_waived' => !empty($row['registration_fee_waived'] ?? null),
            'registration_payment_ref'=> $row['registration_payment_ref'] ?? null,
            'registration_list_fee'   => isset($row['registration_list_fee']) ? (float) $row['registration_list_fee'] : null,
            'registration_discount_amount' => isset($row['registration_discount_amount'])
                ? (float) $row['registration_discount_amount'] : 0.0,
            'registration_amount_due' => isset($row['registration_amount_due']) ? (float) $row['registration_amount_due'] : null,
            'admin_note'          => $row['admin_note'],
            'shop_id'             => $row['shop_id'] !== null ? (int) $row['shop_id'] : null,
            'reviewed_at'         => $row['reviewed_at'],
            'created_at'          => $row['created_at'],
        ];
    }
}
