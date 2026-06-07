<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Marketplace shop records and membership (Phase M4). */
final class ShopService
{
    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM shops WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row === false ? null : self::formatRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function findBySlug(PDO $pdo, string $slug): ?array
    {
        $stmt = $pdo->prepare('SELECT * FROM shops WHERE slug = ? AND status = ? AND is_published = 1');
        $stmt->execute([$slug, 'active']);
        $row = $stmt->fetch();

        if ($row === false) {
            return null;
        }
        if (!ShopBillingService::isShopInGoodStanding($pdo, (int) $row['id'])) {
            return null;
        }

        return self::formatRow($row);
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo): array
    {
        $rows = $pdo->query('SELECT * FROM shops ORDER BY name ASC')->fetchAll();

        return array_map([self::class, 'formatRow'], $rows);
    }

    /** @return list<array<string,mixed>> */
    public static function listPublic(PDO $pdo): array
    {
        $stmt = $pdo->prepare('SELECT * FROM shops WHERE status = ? AND is_published = 1 ORDER BY name ASC');
        $stmt->execute(['active']);

        $rows = array_filter($stmt->fetchAll(), static function (array $row) use ($pdo): bool {
            return ShopBillingService::isShopInGoodStanding($pdo, (int) $row['id']);
        });

        return array_map([self::class, 'formatPublicRow'], array_values($rows));
    }

    public static function userShopId(PDO $pdo, int $userId): ?int
    {
        $stmt = $pdo->prepare('SELECT shop_id FROM shop_members WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    public static function userCanAccessShop(PDO $pdo, int $userId, int $shopId): bool
    {
        $stmt = $pdo->prepare('SELECT 1 FROM shop_members WHERE user_id = ? AND shop_id = ?');
        $stmt->execute([$userId, $shopId]);

        return $stmt->fetchColumn() !== false;
    }

    public static function defaultCommission(PDO $pdo): float
    {
        try {
            $v = $pdo->query(
                'SELECT default_shop_commission_percent FROM company_settings ORDER BY id ASC LIMIT 1'
            )->fetchColumn();
        } catch (\Throwable) {
            return 10.0;
        }

        return $v === false ? 10.0 : round((float) $v, 2);
    }

    public static function commissionForShop(PDO $pdo, array $shop): float
    {
        if (isset($shop['commission_percent']) && $shop['commission_percent'] !== null && $shop['commission_percent'] !== '') {
            return round((float) $shop['commission_percent'], 2);
        }

        return self::defaultCommission($pdo);
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function create(PDO $pdo, array $input): array
    {
        $data = self::validateInput($input);
        $slug = self::uniqueSlug($pdo, $data['slug']);

        $pdo->prepare(
            'INSERT INTO shops
                (name, slug, logo_url, banner_url, description, contact_email, contact_phone, city,
                 commission_percent, bank_name, bank_account_name, bank_account_number, momo_number,
                 status, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $data['name'],
            $slug,
            $data['logo_url'],
            $data['banner_url'],
            $data['description'],
            $data['contact_email'],
            $data['contact_phone'],
            $data['city'],
            $data['commission_percent'],
            $data['bank_name'],
            $data['bank_account_name'],
            $data['bank_account_number'],
            $data['momo_number'],
            $data['status'],
            $data['is_published'],
        ]);

        $id = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO shop_wallets (shop_id) VALUES (?)')->execute([$id]);

        ShopReferralService::ensureReferralCode($pdo, $id);
        if (!empty($input['referred_by_shop_id'])) {
            ShopReferralService::registerReferredShop($pdo, $id, (int) $input['referred_by_shop_id']);
        }

        return self::findById($pdo, $id) ?? [];
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Shop not found.');
        }

        $data = self::validateInput(array_merge($existing, $input));
        $slug = self::uniqueSlug($pdo, $data['slug'], $id);

        $pdo->prepare(
            'UPDATE shops SET
                name = ?, slug = ?, logo_url = ?, banner_url = ?, description = ?,
                contact_email = ?, contact_phone = ?, city = ?, commission_percent = ?,
                bank_name = ?, bank_account_name = ?, bank_account_number = ?, momo_number = ?,
                status = ?, is_published = ?
             WHERE id = ?'
        )->execute([
            $data['name'],
            $slug,
            $data['logo_url'],
            $data['banner_url'],
            $data['description'],
            $data['contact_email'],
            $data['contact_phone'],
            $data['city'],
            $data['commission_percent'],
            $data['bank_name'],
            $data['bank_account_name'],
            $data['bank_account_number'],
            $data['momo_number'],
            $data['status'],
            $data['is_published'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    /**
     * Seller-safe profile fields (logo optional).
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function updateProfile(PDO $pdo, int $shopId, array $input): array
    {
        $existing = self::findById($pdo, $shopId);
        if ($existing === null) {
            throw new \InvalidArgumentException('Shop not found.');
        }

        $patch = [];
        foreach (['name', 'description', 'contact_phone', 'logo_url', 'banner_url', 'bank_name', 'bank_account_name', 'bank_account_number', 'momo_number'] as $key) {
            if (!array_key_exists($key, $input)) {
                continue;
            }
            if ($key === 'logo_url' || $key === 'banner_url') {
                $patch[$key] = self::nullableString($input[$key]);
                continue;
            }
            if ($key === 'name') {
                $name = trim((string) $input['name']);
                if ($name === '') {
                    throw new \InvalidArgumentException('Shop name cannot be empty.');
                }
                $patch['name'] = $name;
                continue;
            }
            $patch[$key] = $key === 'description'
                ? self::nullableString($input[$key])
                : self::nullableString($input[$key]);
        }

        if ($patch === []) {
            return $existing;
        }

        return self::update($pdo, $shopId, array_merge($existing, $patch));
    }

    public static function addOwner(PDO $pdo, int $shopId, int $userId): void
    {
        $pdo->prepare(
            'INSERT INTO shop_members (shop_id, user_id, role) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role)'
        )->execute([$shopId, $userId, 'owner']);
    }

    /** @param array<string,mixed> $input */
    private static function validateInput(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['contact_email'] ?? $input['email'] ?? '')));
        $city = trim((string) ($input['city'] ?? ''));
        if ($name === '' || $email === '' || $city === '') {
            throw new \InvalidArgumentException('Shop name, email, and city are required.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = self::slugify($name);
        } else {
            $slug = self::slugify($slug);
        }

        $status = strtolower(trim((string) ($input['status'] ?? 'active')));
        if (!in_array($status, ['pending', 'active', 'suspended'], true)) {
            $status = 'active';
        }

        $commission = $input['commission_percent'] ?? null;
        $commission = ($commission === null || $commission === '') ? null : round((float) $commission, 2);

        return [
            'name'                => $name,
            'slug'                => $slug,
            'logo_url'            => self::nullableString($input['logo_url'] ?? null),
            'banner_url'          => self::nullableString($input['banner_url'] ?? null),
            'description'         => self::nullableString($input['description'] ?? null),
            'contact_email'       => $email,
            'contact_phone'       => self::nullableString($input['contact_phone'] ?? $input['phone'] ?? null),
            'city'                => $city,
            'commission_percent'  => $commission,
            'bank_name'           => self::nullableString($input['bank_name'] ?? null),
            'bank_account_name'   => self::nullableString($input['bank_account_name'] ?? null),
            'bank_account_number' => self::nullableString($input['bank_account_number'] ?? null),
            'momo_number'         => self::nullableString($input['momo_number'] ?? null),
            'status'              => $status,
            'is_published'        => !empty($input['is_published']) ? 1 : 0,
        ];
    }

    private static function slugify(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'shop';
    }

    private static function uniqueSlug(PDO $pdo, string $base, ?int $excludeId = null): string
    {
        $slug = $base;
        $n = 1;
        while (true) {
            $sql = 'SELECT id FROM shops WHERE slug = ?';
            $params = [$slug];
            if ($excludeId !== null) {
                $sql .= ' AND id != ?';
                $params[] = $excludeId;
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            if ($stmt->fetch() === false) {
                return $slug;
            }
            $slug = $base . '-' . $n;
            $n++;
        }
    }

    private static function nullableString(mixed $value): ?string
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
            'name'                => $row['name'],
            'slug'                => $row['slug'],
            'referral_code'       => $row['referral_code'] ?? null,
            'referred_by_shop_id' => isset($row['referred_by_shop_id']) && $row['referred_by_shop_id'] !== null
                ? (int) $row['referred_by_shop_id'] : null,
            'logo_url'            => $row['logo_url'],
            'banner_url'          => $row['banner_url'],
            'description'         => $row['description'],
            'contact_email'       => $row['contact_email'],
            'contact_phone'       => $row['contact_phone'],
            'city'                => $row['city'],
            'commission_percent'  => $row['commission_percent'] !== null ? (float) $row['commission_percent'] : null,
            'bank_name'           => $row['bank_name'],
            'bank_account_name'   => $row['bank_account_name'],
            'bank_account_number' => $row['bank_account_number'],
            'momo_number'         => $row['momo_number'],
            'status'              => $row['status'],
            'is_published'        => (bool) $row['is_published'],
            'created_at'          => $row['created_at'],
            'updated_at'          => $row['updated_at'],
        ];
    }

    /** @param array<string,mixed> $row */
    private static function formatPublicRow(array $row): array
    {
        $formatted = self::formatRow($row);
        unset(
            $formatted['bank_name'],
            $formatted['bank_account_name'],
            $formatted['bank_account_number'],
            $formatted['momo_number'],
            $formatted['commission_percent'],
            $formatted['created_at'],
            $formatted['updated_at']
        );

        return $formatted;
    }

    /** @return array{name:string,slug:string,logo_url:?string}|null */
    public static function shopSummaryForProduct(PDO $pdo, ?int $shopId): ?array
    {
        if ($shopId === null || $shopId <= 0) {
            return null;
        }
        $shop = self::findById($pdo, $shopId);
        if ($shop === null || $shop['status'] !== 'active') {
            return null;
        }

        return [
            'id'       => $shop['id'],
            'name'     => $shop['name'],
            'slug'     => $shop['slug'],
            'logo_url' => $shop['logo_url'],
        ];
    }
}
