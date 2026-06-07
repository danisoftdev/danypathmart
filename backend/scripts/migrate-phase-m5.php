<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);
    $dir = strtolower(array_shift($parts));
    $path = __DIR__ . '/../' . $dir . '/' . implode('/', $parts) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use App\Config\Database;

function columnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);

    return (int) $stmt->fetchColumn() > 0;
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $stmt->execute([$table]);

    return (int) $stmt->fetchColumn() > 0;
}

$pdo = Database::pdo();

$sql = file_get_contents(__DIR__ . '/../../database/migrations/037_shop_referrals_m5.sql');
if ($sql !== false) {
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement === '') {
            continue;
        }
        try {
            $pdo->exec($statement);
            echo "OK: " . substr(str_replace("\n", ' ', $statement), 0, 80) . "…\n";
        } catch (\Throwable $e) {
            echo "Skip/note: {$e->getMessage()}\n";
        }
    }
}

// Backfill referral codes for existing shops
if (columnExists($pdo, 'shops', 'referral_code')) {
    $rows = $pdo->query('SELECT id, slug FROM shops WHERE referral_code IS NULL OR referral_code = ""')->fetchAll();
    foreach ($rows as $row) {
        $code = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $row['slug'])) ?? '', 0, 6));
        if (strlen($code) < 4) {
            $code = 'SHOP' . (int) $row['id'];
        }
        $n = 0;
        while (true) {
            $try = $n === 0 ? $code : $code . $n;
            $chk = $pdo->prepare('SELECT 1 FROM shops WHERE referral_code = ? AND id != ?');
            $chk->execute([$try, (int) $row['id']]);
            if ($chk->fetch() === false) {
                $pdo->prepare('UPDATE shops SET referral_code = ? WHERE id = ?')->execute([$try, (int) $row['id']]);
                echo "Set referral_code {$try} for shop #{$row['id']}\n";
                break;
            }
            $n++;
        }
    }
}

if (!columnExists($pdo, 'shop_applications', 'referred_by_shop_code')) {
    $pdo->exec('ALTER TABLE shop_applications ADD COLUMN referred_by_shop_code VARCHAR(40) DEFAULT NULL');
    echo "Added shop_applications.referred_by_shop_code\n";
}
if (!columnExists($pdo, 'shop_applications', 'referred_by_shop_id')) {
    $pdo->exec('ALTER TABLE shop_applications ADD COLUMN referred_by_shop_id BIGINT UNSIGNED DEFAULT NULL');
    echo "Added shop_applications.referred_by_shop_id\n";
}

echo "Phase M5 shop referrals migration complete.\n";
