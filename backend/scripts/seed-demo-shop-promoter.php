<?php

declare(strict_types=1);

/**
 * Create/update demo shop owner + promoter + buyer accounts with funded wallets,
 * and seed approved products on the demo shop (for recordings/demos).
 *
 * Usage (on server):
 *   php backend/scripts/seed-demo-shop-promoter.php
 */

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
use App\Config\Env;
use App\Helpers\PromoterWalletService;
use App\Helpers\ShopService;
use App\Helpers\ShopWalletService;
use App\Helpers\WalletService;

Env::load();
$pdo = Database::pdo();

$shopEmail = 'demo.shop@danypathmart.store';
$shopPassword = 'DemoShop@2026!';
$shopName = 'Demo Recording Shop';
$shopSlug = 'demo-recording-shop';

$promoEmail = 'demo.promoter@danypathmart.store';
$promoPassword = 'DemoPromo@2026!';
$promoCode = 'DEMOPROMO';
$promoDisplay = 'Demo Promoter';

$buyerEmail = 'demo.buyer@danypathmart.store';
$buyerPassword = 'DemoBuyer@2026!';
$buyerName = 'Demo Shop Buyer';
$buyerUsername = 'demoshopbuyer';

$shopCredit = 1500.00;
$promoCredit = 800.00;
$buyerCredit = 1200.00;

$demoProducts = [
    [
        'name'        => 'Demo Wireless Earbuds',
        'slug'        => 'demo-wireless-earbuds',
        'description' => 'Compact Bluetooth earbuds for demo checkout flows.',
        'price'       => 89.00,
        'stock_qty'   => 40,
    ],
    [
        'name'        => 'Demo Cotton T-Shirt',
        'slug'        => 'demo-cotton-tshirt',
        'description' => 'Soft everyday tee — seeded for shop recordings.',
        'price'       => 45.00,
        'stock_qty'   => 80,
    ],
    [
        'name'        => 'Demo Phone Stand',
        'slug'        => 'demo-phone-stand',
        'description' => 'Adjustable desk stand for phones and small tablets.',
        'price'       => 35.00,
        'stock_qty'   => 60,
    ],
    [
        'name'        => 'Demo Water Bottle',
        'slug'        => 'demo-water-bottle',
        'description' => '750ml reusable bottle for demo product browsing.',
        'price'       => 28.00,
        'stock_qty'   => 100,
    ],
    [
        'name'        => 'Demo Notebook Set',
        'slug'        => 'demo-notebook-set',
        'description' => 'A4 ruled notebooks (pack of 3).',
        'price'       => 22.00,
        'stock_qty'   => 120,
    ],
];

$hashShop = password_hash($shopPassword, PASSWORD_BCRYPT, ['cost' => 12]);
$hashPromo = password_hash($promoPassword, PASSWORD_BCRYPT, ['cost' => 12]);
$hashBuyer = password_hash($buyerPassword, PASSWORD_BCRYPT, ['cost' => 12]);

try {
    // ── Shop owner (customer role + shop_members owner) ─────────────────────
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$shopEmail]);
    $shopUserId = (int) ($stmt->fetchColumn() ?: 0);

    if ($shopUserId <= 0) {
        $pdo->prepare(
            "INSERT INTO users (name, username, email, password_hash, role, status, preferred_currency, totp_enabled)
             VALUES (?, ?, ?, ?, 'customer', 'verified', 'GHS', 0)"
        )->execute(['Demo Shop Owner', 'demoshopowner', $shopEmail, $hashShop]);
        $shopUserId = (int) $pdo->lastInsertId();
        echo "Created shop owner user #{$shopUserId}\n";
    } else {
        $pdo->prepare(
            "UPDATE users SET name = ?, username = ?, password_hash = ?, role = 'customer', status = 'verified', totp_enabled = 0 WHERE id = ?"
        )->execute(['Demo Shop Owner', 'demoshopowner', $hashShop, $shopUserId]);
        echo "Updated shop owner user #{$shopUserId}\n";
    }

    $stmt = $pdo->prepare('SELECT id FROM shops WHERE slug = ? LIMIT 1');
    $stmt->execute([$shopSlug]);
    $shopId = (int) ($stmt->fetchColumn() ?: 0);

    if ($shopId <= 0) {
        $shop = ShopService::create($pdo, [
            'name'          => $shopName,
            'slug'          => $shopSlug,
            'contact_email' => $shopEmail,
            'city'          => 'Accra',
            'description'   => 'Demo shop for product recording / walkthroughs.',
            'status'        => 'active',
            'is_published'  => 1,
        ]);
        $shopId = (int) ($shop['id'] ?? 0);
        echo "Created shop #{$shopId}\n";
    } else {
        try {
            $pdo->prepare(
                "UPDATE shops SET name = ?, contact_email = ?, status = 'active', is_published = 1 WHERE id = ?"
            )->execute([$shopName, $shopEmail, $shopId]);
        } catch (\Throwable) {
            $pdo->prepare(
                "UPDATE shops SET name = ?, contact_email = ?, status = 'active' WHERE id = ?"
            )->execute([$shopName, $shopEmail, $shopId]);
        }
        echo "Updated shop #{$shopId}\n";
    }

    if ($shopId <= 0) {
        throw new RuntimeException('Could not resolve shop id.');
    }

    ShopService::addOwner($pdo, $shopId, $shopUserId);

    // Keep storefront visible for demos when billing is enabled.
    try {
        $pdo->prepare(
            "UPDATE shops SET storefront_mode = 'open' WHERE id = ?"
        )->execute([$shopId]);
    } catch (\Throwable) {
        // Column may not exist on older DBs.
    }
    try {
        $cols = $pdo->query('SHOW COLUMNS FROM shop_subscriptions')->fetchAll(PDO::FETCH_COLUMN);
        $hasEnd = in_array('current_period_end', $cols, true);
        $hasStart = in_array('current_period_start', $cols, true);
        $existsSub = (int) $pdo->query(
            "SELECT COUNT(*) FROM shop_subscriptions WHERE shop_id = {$shopId}"
        )->fetchColumn();
        if ($existsSub === 0 && $hasEnd) {
            if ($hasStart) {
                $pdo->prepare(
                    "INSERT INTO shop_subscriptions (shop_id, status, current_period_start, current_period_end)
                     VALUES (?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))"
                )->execute([$shopId]);
            } else {
                $pdo->prepare(
                    "INSERT INTO shop_subscriptions (shop_id, status, current_period_end)
                     VALUES (?, 'active', DATE_ADD(NOW(), INTERVAL 1 YEAR))"
                )->execute([$shopId]);
            }
        } elseif ($existsSub > 0 && $hasEnd) {
            $pdo->prepare(
                "UPDATE shop_subscriptions SET status = 'active', current_period_end = DATE_ADD(NOW(), INTERVAL 1 YEAR) WHERE shop_id = ?"
            )->execute([$shopId]);
        }
    } catch (\Throwable $e) {
        echo "Note: shop subscription skip — " . $e->getMessage() . "\n";
    }

    ShopWalletService::getWallet($pdo, $shopId);
    $wallet = ShopWalletService::getWallet($pdo, $shopId);
    $need = max(0, $shopCredit - (float) $wallet['balance_available']);
    if ($need > 0) {
        ShopWalletService::creditAvailable($pdo, $shopId, $need, null, 'Demo recording wallet top-up');
        echo "Credited shop wallet +GHS {$need}\n";
    } else {
        echo "Shop wallet already funded (available >= {$shopCredit})\n";
    }

    // ── Promoter ────────────────────────────────────────────────────────────
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$promoEmail]);
    $promoUserId = (int) ($stmt->fetchColumn() ?: 0);

    if ($promoUserId <= 0) {
        $pdo->prepare(
            "INSERT INTO users (name, username, email, password_hash, role, status, preferred_currency, totp_enabled)
             VALUES (?, ?, ?, ?, 'promoter', 'verified', 'GHS', 0)"
        )->execute([$promoDisplay, 'demopromoter', $promoEmail, $hashPromo]);
        $promoUserId = (int) $pdo->lastInsertId();
        echo "Created promoter user #{$promoUserId}\n";
    } else {
        $pdo->prepare(
            "UPDATE users SET name = ?, username = ?, password_hash = ?, role = 'promoter', status = 'verified', totp_enabled = 0 WHERE id = ?"
        )->execute([$promoDisplay, 'demopromoter', $hashPromo, $promoUserId]);
        echo "Updated promoter user #{$promoUserId}\n";
    }

    $stmt = $pdo->prepare('SELECT id FROM promoters WHERE user_id = ? LIMIT 1');
    $stmt->execute([$promoUserId]);
    $promoterId = (int) ($stmt->fetchColumn() ?: 0);

    if ($promoterId <= 0) {
        $code = $promoCode;
        $codeStmt = $pdo->prepare('SELECT id FROM promoters WHERE code = ? LIMIT 1');
        $codeStmt->execute([$code]);
        if ($codeStmt->fetchColumn()) {
            $code = $promoCode . substr((string) time(), -4);
        }
        $pdo->prepare(
            "INSERT INTO promoters (user_id, display_name, code, status, approved_at)
             VALUES (?, ?, ?, 'active', NOW())"
        )->execute([$promoUserId, $promoDisplay, $code]);
        $promoterId = (int) $pdo->lastInsertId();
        echo "Created promoter #{$promoterId} (code {$code})\n";
    } else {
        $pdo->prepare(
            "UPDATE promoters SET display_name = ?, code = ?, status = 'active', approved_at = COALESCE(approved_at, NOW()) WHERE id = ?"
        )->execute([$promoDisplay, $promoCode, $promoterId]);
        echo "Updated promoter #{$promoterId}\n";
    }

    PromoterWalletService::getWallet($pdo, $promoterId);
    $pWallet = PromoterWalletService::getWallet($pdo, $promoterId);
    $pNeed = max(0, $promoCredit - (float) $pWallet['balance_available']);
    if ($pNeed > 0) {
        PromoterWalletService::creditPending($pdo, $promoterId, $pNeed, 0, 'Demo recording wallet top-up');
        PromoterWalletService::releasePending($pdo, $promoterId, $pNeed, 0);
        echo "Credited promoter wallet +GHS {$pNeed}\n";
    } else {
        echo "Promoter wallet already funded (available >= {$promoCredit})\n";
    }

    // ── Demo products on shop ───────────────────────────────────────────────
    $imagesJson = json_encode(['/uploads/placeholder.png']);
    $productCount = 0;
    foreach ($demoProducts as $p) {
        $slug = $p['slug'] . '-' . $shopId;
        $stmt = $pdo->prepare('SELECT id FROM products WHERE shop_id = ? AND slug = ? LIMIT 1');
        $stmt->execute([$shopId, $slug]);
        $existingPid = (int) ($stmt->fetchColumn() ?: 0);

        if ($existingPid > 0) {
            $pdo->prepare(
                "UPDATE products
                 SET name = ?, description = ?, price = ?, stock_qty = ?, status = 'active', listing_status = 'approved', images = ?
                 WHERE id = ?"
            )->execute([
                $p['name'],
                $p['description'],
                $p['price'],
                $p['stock_qty'],
                $imagesJson,
                $existingPid,
            ]);
            echo "Updated product #{$existingPid} ({$p['name']})\n";
        } else {
            try {
                $pdo->prepare(
                    "INSERT INTO products (shop_id, name, slug, description, price, stock_qty, images, status, listing_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'approved')"
                )->execute([
                    $shopId,
                    $p['name'],
                    $slug,
                    $p['description'],
                    $p['price'],
                    $p['stock_qty'],
                    $imagesJson,
                ]);
            } catch (\Throwable) {
                $pdo->prepare(
                    "INSERT INTO products (shop_id, name, slug, description, price, stock_qty, images,
                     shop_badge_label, shop_promo_free_delivery, status, listing_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 'active', 'approved')"
                )->execute([
                    $shopId,
                    $p['name'],
                    $slug,
                    $p['description'],
                    $p['price'],
                    $p['stock_qty'],
                    $imagesJson,
                ]);
            }
            $newPid = (int) $pdo->lastInsertId();
            echo "Created product #{$newPid} ({$p['name']})\n";
        }
        $productCount++;
    }
    echo "Demo shop products ready: {$productCount}\n";

    // ── Shop buyer (customer wallet) ────────────────────────────────────────
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$buyerEmail]);
    $buyerUserId = (int) ($stmt->fetchColumn() ?: 0);

    if ($buyerUserId <= 0) {
        $pdo->prepare(
            "INSERT INTO users (name, username, email, password_hash, role, status, preferred_currency, totp_enabled)
             VALUES (?, ?, ?, ?, 'customer', 'verified', 'GHS', 0)"
        )->execute([$buyerName, $buyerUsername, $buyerEmail, $hashBuyer]);
        $buyerUserId = (int) $pdo->lastInsertId();
        echo "Created buyer user #{$buyerUserId}\n";
    } else {
        $pdo->prepare(
            "UPDATE users SET name = ?, username = ?, password_hash = ?, role = 'customer', status = 'verified', totp_enabled = 0 WHERE id = ?"
        )->execute([$buyerName, $buyerUsername, $hashBuyer, $buyerUserId]);
        echo "Updated buyer user #{$buyerUserId}\n";
    }

    $buyerBalance = WalletService::getBalance($pdo, $buyerUserId);
    $bNeed = max(0, $buyerCredit - $buyerBalance);
    if ($bNeed > 0) {
        WalletService::credit(
            $pdo,
            $buyerUserId,
            $bNeed,
            'admin_credit',
            null,
            'Demo recording buyer wallet top-up',
            null
        );
        echo "Credited buyer wallet +GHS {$bNeed}\n";
    } else {
        echo "Buyer wallet already funded (balance >= {$buyerCredit})\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'FAILED: ' . $e->getMessage() . "\n");
    exit(1);
}

$shopWallet = ShopWalletService::getWallet($pdo, $shopId);
$promoWallet = PromoterWalletService::getWallet($pdo, $promoterId);
$code = (string) $pdo->query("SELECT code FROM promoters WHERE id = {$promoterId}")->fetchColumn();
$buyerBalance = WalletService::getBalance($pdo, $buyerUserId);
$listed = (int) $pdo->query(
    "SELECT COUNT(*) FROM products WHERE shop_id = {$shopId} AND status = 'active' AND listing_status = 'approved'"
)->fetchColumn();

echo "\n========== DEMO ACCOUNTS ==========\n";
echo "SHOP OWNER\n";
echo "  Email:    {$shopEmail}\n";
echo "  Password: {$shopPassword}\n";
echo "  Shop:     {$shopName} (/stores/{$shopSlug})\n";
echo "  Seller:   /seller\n";
echo "  Products: {$listed} active/approved\n";
echo "  Wallet available: GHS " . number_format((float) $shopWallet['balance_available'], 2) . "\n";
echo "\nSHOP BUYER\n";
echo "  Email:    {$buyerEmail}\n";
echo "  Password: {$buyerPassword}\n";
echo "  Login:    /login (customer)\n";
echo "  Wallet:   GHS " . number_format($buyerBalance, 2) . "\n";
echo "\nPROMOTER\n";
echo "  Email:    {$promoEmail}\n";
echo "  Password: {$promoPassword}\n";
echo "  Code:     {$code}\n";
echo "  Dashboard:/promoter\n";
echo "  Wallet available: GHS " . number_format((float) $promoWallet['balance_available'], 2) . "\n";
echo "===================================\n";
