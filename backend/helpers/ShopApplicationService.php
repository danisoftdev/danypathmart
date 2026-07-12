<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Shop onboarding applications (Phase M4). */
final class ShopApplicationService
{
    public const POLICY_SLUGS = 'terms,privacy,shop-seller-policy,seller-handbook,payments';

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

        $acceptedTerms = !empty($input['accepted_terms']);
        $acceptedPrivacy = !empty($input['accepted_privacy']);
        $acceptedSellerPolicy = !empty($input['accepted_seller_policy']);
        $acceptedPolicies = !empty($input['accepted_policies'])
            || ($acceptedTerms && $acceptedPrivacy && $acceptedSellerPolicy);

        if (!$acceptedTerms || !$acceptedPrivacy || !$acceptedSellerPolicy || !$acceptedPolicies) {
            throw new \InvalidArgumentException(
                'You must accept the Terms, Privacy policy, and Shop seller policy to apply.'
            );
        }

        $businessName = trim((string) ($input['business_name'] ?? ''));
        $contactName = trim((string) ($input['contact_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? ''));
        $customerServicePhone = trim((string) ($input['customer_service_phone'] ?? ''));
        $city = trim((string) ($input['city'] ?? ''));

        if ($businessName === '' || $contactName === '' || $email === '' || $phone === '' || $customerServicePhone === '' || $city === '') {
            throw new \InvalidArgumentException('Please fill in all required fields.');
        }

        if ($userId !== null) {
            $existingShop = ShopService::userShopId($pdo, $userId);
            if ($existingShop !== null) {
                throw new \InvalidArgumentException('You already have a shop on DanyPathMart.');
            }
        }

        $inviteToken = self::nullable($input['invite_token'] ?? null);
        $invite = null;
        $source = 'public';
        if ($inviteToken !== null) {
            $invite = ShopInviteService::findByToken($pdo, $inviteToken);
            if ($invite === null || ($invite['status'] ?? '') !== 'pending') {
                throw new \InvalidArgumentException('This invite is invalid or has expired.');
            }
            $source = 'invite';
            if (empty($email)) {
                $email = strtolower((string) $invite['email']);
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

        $acceptedIp = self::nullable($input['policies_accepted_ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? null));
        $acceptedUa = self::nullable($input['policies_accepted_user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? null));
        if ($acceptedUa !== null && strlen($acceptedUa) > 255) {
            $acceptedUa = substr($acceptedUa, 0, 255);
        }

        $id = self::insertApplication($pdo, [
            'user_id' => $userId,
            'business_name' => $businessName,
            'contact_name' => $contactName,
            'email' => $email,
            'phone' => $phone,
            'customer_service_phone' => $customerServicePhone,
            'city' => $city,
            'street_address' => self::nullable($input['street_address'] ?? null),
            'region' => self::nullable($input['region'] ?? null),
            'latitude' => LocationHelper::parseLatLng($input)['latitude'],
            'longitude' => LocationHelper::parseLatLng($input)['longitude'],
            'allows_shop_pickup' => !empty($input['allows_shop_pickup']) ? 1 : 0,
            'description' => self::nullable($input['description'] ?? null),
            'logo_url' => $logoUrl,
            'referred_by_shop_code' => $referredCode,
            'referred_by_shop_id' => $referrerShopId,
            'referred_by_type' => $referrerType,
            'referred_by_promoter_id' => $referrerPromoterId,
            'bank_name' => self::nullable($input['bank_name'] ?? null),
            'bank_account_name' => self::nullable($input['bank_account_name'] ?? null),
            'bank_account_number' => self::nullable($input['bank_account_number'] ?? null),
            'momo_number' => self::nullable($input['momo_number'] ?? null),
            'source' => $source,
            'accepted_terms' => 1,
            'accepted_privacy' => 1,
            'accepted_seller_policy' => 1,
            'accepted_policy_slugs' => self::POLICY_SLUGS,
            'policies_accepted_ip' => $acceptedIp,
            'policies_accepted_user_agent' => $acceptedUa,
        ]);

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

        if ($inviteToken !== null) {
            ShopInviteService::markAccepted($pdo, $inviteToken, $id);
        }

        $result = self::findById($pdo, $id) ?? [];
        $result['requires_payment'] = ShopBillingService::registrationRequired($pdo, $result);

        return $result;
    }

    /**
     * Admin creates a pre-approved application (policy acceptance admin-attested).
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function createPreapproved(PDO $pdo, array $input, int $adminUserId): array
    {
        $businessName = trim((string) ($input['business_name'] ?? $input['name'] ?? ''));
        $contactName = trim((string) ($input['contact_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? $input['contact_email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? $input['contact_phone'] ?? ''));
        $customerServicePhone = trim((string) ($input['customer_service_phone'] ?? $phone));
        $city = trim((string) ($input['city'] ?? ''));

        if ($businessName === '' || $contactName === '' || $email === '' || $phone === '' || $city === '') {
            throw new \InvalidArgumentException('Business name, contact name, email, phone, and city are required.');
        }
        if ($customerServicePhone === '') {
            $customerServicePhone = $phone;
        }

        $adminNote = self::nullable($input['admin_note'] ?? null);
        $attestedNote = 'Policy acceptance admin-attested.';
        $note = $adminNote !== null ? $attestedNote . ' ' . $adminNote : $attestedNote;

        $id = self::insertApplication($pdo, [
            'user_id' => !empty($input['owner_user_id']) ? (int) $input['owner_user_id'] : null,
            'business_name' => $businessName,
            'contact_name' => $contactName,
            'email' => $email,
            'phone' => $phone,
            'customer_service_phone' => $customerServicePhone,
            'city' => $city,
            'street_address' => self::nullable($input['street_address'] ?? null),
            'region' => self::nullable($input['region'] ?? null),
            'latitude' => LocationHelper::parseLatLng($input)['latitude'],
            'longitude' => LocationHelper::parseLatLng($input)['longitude'],
            'allows_shop_pickup' => !empty($input['allows_shop_pickup']) ? 1 : 0,
            'description' => self::nullable($input['description'] ?? null),
            'logo_url' => self::nullable($input['logo_url'] ?? null),
            'referred_by_shop_code' => null,
            'referred_by_shop_id' => null,
            'referred_by_type' => null,
            'referred_by_promoter_id' => null,
            'bank_name' => self::nullable($input['bank_name'] ?? null),
            'bank_account_name' => self::nullable($input['bank_account_name'] ?? null),
            'bank_account_number' => self::nullable($input['bank_account_number'] ?? null),
            'momo_number' => self::nullable($input['momo_number'] ?? null),
            'source' => 'admin_preapproved',
            'created_by_admin_id' => $adminUserId,
            'admin_note' => $note,
            'accepted_terms' => 1,
            'accepted_privacy' => 1,
            'accepted_seller_policy' => 1,
            'accepted_policy_slugs' => self::POLICY_SLUGS,
            'policies_accepted_ip' => self::nullable($_SERVER['REMOTE_ADDR'] ?? null),
            'policies_accepted_user_agent' => 'admin-attested',
        ]);

        // Pre-approved apps skip payment gate for approval flow.
        try {
            $pdo->prepare(
                'UPDATE shop_applications SET registration_fee_waived = 1, status = ? WHERE id = ?'
            )->execute(['new', $id]);
        } catch (\Throwable) {
            $pdo->prepare('UPDATE shop_applications SET status = ? WHERE id = ?')
                ->execute(['new', $id]);
        }

        $application = self::findById($pdo, $id) ?? [];
        $shop = null;

        if (!empty($input['auto_approve'])) {
            $shop = self::approve($pdo, $id, $adminUserId, $note);
            $application = self::findById($pdo, $id) ?? $application;
        }

        return [
            'application' => $application,
            'shop'        => $shop,
        ];
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function insertApplication(PDO $pdo, array $data): int
    {
        $coords = [
            'latitude'  => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
        ];

        try {
            $pdo->prepare(
                'INSERT INTO shop_applications
                    (user_id, business_name, contact_name, email, phone, customer_service_phone, city, street_address, region,
                     latitude, longitude, allows_shop_pickup, description, logo_url,
                     referred_by_shop_code, referred_by_shop_id, referred_by_type, referred_by_promoter_id,
                     bank_name, bank_account_name, bank_account_number, momo_number,
                     source, created_by_admin_id, admin_note,
                     accepted_policies_at, accepted_policy_slugs, accepted_terms, accepted_privacy, accepted_seller_policy,
                     policies_accepted_ip, policies_accepted_user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)'
            )->execute([
                $data['user_id'],
                $data['business_name'],
                $data['contact_name'],
                $data['email'],
                $data['phone'],
                $data['customer_service_phone'],
                $data['city'],
                $data['street_address'],
                $data['region'],
                $coords['latitude'],
                $coords['longitude'],
                $data['allows_shop_pickup'] ?? 0,
                $data['description'],
                $data['logo_url'],
                $data['referred_by_shop_code'],
                $data['referred_by_shop_id'],
                $data['referred_by_type'],
                $data['referred_by_promoter_id'],
                $data['bank_name'],
                $data['bank_account_name'],
                $data['bank_account_number'],
                $data['momo_number'],
                $data['source'] ?? 'public',
                $data['created_by_admin_id'] ?? null,
                $data['admin_note'] ?? null,
                $data['accepted_policy_slugs'] ?? self::POLICY_SLUGS,
                (int) ($data['accepted_terms'] ?? 0),
                (int) ($data['accepted_privacy'] ?? 0),
                (int) ($data['accepted_seller_policy'] ?? 0),
                $data['policies_accepted_ip'] ?? null,
                $data['policies_accepted_user_agent'] ?? null,
            ]);
        } catch (\Throwable) {
            try {
                $pdo->prepare(
                    'INSERT INTO shop_applications
                        (user_id, business_name, contact_name, email, phone, customer_service_phone, city, street_address, region,
                         latitude, longitude, allows_shop_pickup, description, logo_url,
                         referred_by_shop_code, referred_by_shop_id, referred_by_type, referred_by_promoter_id,
                         bank_name, bank_account_name, bank_account_number, momo_number)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $data['user_id'],
                    $data['business_name'],
                    $data['contact_name'],
                    $data['email'],
                    $data['phone'],
                    $data['customer_service_phone'],
                    $data['city'],
                    $data['street_address'],
                    $data['region'],
                    $coords['latitude'],
                    $coords['longitude'],
                    $data['allows_shop_pickup'] ?? 0,
                    $data['description'],
                    $data['logo_url'],
                    $data['referred_by_shop_code'],
                    $data['referred_by_shop_id'],
                    $data['referred_by_type'],
                    $data['referred_by_promoter_id'],
                    $data['bank_name'],
                    $data['bank_account_name'],
                    $data['bank_account_number'],
                    $data['momo_number'],
                ]);
            } catch (\Throwable) {
                $pdo->prepare(
                    'INSERT INTO shop_applications
                        (user_id, business_name, contact_name, email, phone, city, description,
                         bank_name, bank_account_name, bank_account_number, momo_number)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $data['user_id'],
                    $data['business_name'],
                    $data['contact_name'],
                    $data['email'],
                    $data['phone'],
                    $data['city'],
                    $data['description'],
                    $data['bank_name'],
                    $data['bank_account_name'],
                    $data['bank_account_number'],
                    $data['momo_number'],
                ]);
            }
        }

        return (int) $pdo->lastInsertId();
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
                'name'                   => $app['business_name'],
                'logo_url'               => $app['logo_url'] ?? null,
                'contact_email'          => $app['email'],
                'contact_phone'          => $app['phone'],
                'customer_service_phone' => $app['customer_service_phone'] ?? null,
                'city'                   => $app['city'],
                'street_address'         => $app['street_address'] ?? null,
                'region'                 => $app['region'] ?? null,
                'latitude'               => $app['latitude'] ?? null,
                'longitude'              => $app['longitude'] ?? null,
                'allows_shop_pickup'     => !empty($app['allows_shop_pickup']),
                'description'            => $app['description'],
                'bank_name'              => $app['bank_name'],
                'bank_account_name'      => $app['bank_account_name'],
                'bank_account_number'    => $app['bank_account_number'],
                'momo_number'            => $app['momo_number'],
                'status'                 => 'active',
                'is_published'           => true,
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
            'customer_service_phone' => $row['customer_service_phone'] ?? null,
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
            'source'              => $row['source'] ?? 'public',
            'created_by_admin_id' => isset($row['created_by_admin_id']) && $row['created_by_admin_id'] !== null
                ? (int) $row['created_by_admin_id'] : null,
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
            'accepted_policies_at' => $row['accepted_policies_at'] ?? null,
            'accepted_policy_slugs' => $row['accepted_policy_slugs'] ?? null,
            'accepted_terms'      => !empty($row['accepted_terms'] ?? null),
            'accepted_privacy'    => !empty($row['accepted_privacy'] ?? null),
            'accepted_seller_policy' => !empty($row['accepted_seller_policy'] ?? null),
            'policies_accepted_ip' => $row['policies_accepted_ip'] ?? null,
            'policies_accepted_user_agent' => $row['policies_accepted_user_agent'] ?? null,
        ];
    }
}
