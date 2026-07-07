<?php

declare(strict_types=1);

/**
 * Run every database/migrations/*.sql file in numeric order, then post-migration hooks.
 *
 * Prerequisites:
 *   1. MySQL database created
 *   2. database/schema.sql imported
 *   3. database/seed.sql imported (optional but recommended for dev/staging)
 *
 * Usage (from repo root or backend/):
 *   php backend/scripts/migrate-all.php
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
use App\Helpers\CareerService;
use App\Helpers\EmployeeService;
use App\Helpers\LegalPolicySeeder;

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $stmt->execute([$table]);

    return (int) $stmt->fetchColumn() > 0;
}

/** Hostinger: public_html/database/migrations — dev repo: database/migrations */
function migrationsDir(): ?string
{
    foreach ([
        __DIR__ . '/../../database/migrations',
        __DIR__ . '/../database/migrations',
    ] as $candidate) {
        $resolved = realpath($candidate);
        if ($resolved !== false && is_dir($resolved)) {
            return $resolved;
        }
    }

    return null;
}

/** @return list<string> */
function sortedMigrationSqlFiles(): array
{
    $dir = migrationsDir();
    if ($dir === null) {
        return [];
    }

    $files = glob($dir . '/*.sql') ?: [];
    $unique = [];
    foreach ($files as $file) {
        $base = basename($file);
        if (preg_match('/^(\d{3})_/i', $base) !== 1) {
            continue;
        }
        $unique[$base] = $file;
    }
    ksort($unique, SORT_NATURAL);

    return array_values($unique);
}

function runSqlFile(PDO $pdo, string $path): void
{
    $name = basename($path);
    echo "\n── {$name}\n";

    $sql = file_get_contents($path);
    if ($sql === false) {
        echo "  ERROR: could not read file\n";
        return;
    }

    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement === '') {
            continue;
        }
        // Strip leading SQL comments so CREATE blocks after a file header comment are not skipped.
        $statement = preg_replace('/^(\s*--[^\n]*\n)+/', '', $statement) ?? $statement;
        $statement = trim($statement);
        if ($statement === '' || str_starts_with($statement, '--')) {
            continue;
        }
        try {
            $pdo->exec($statement);
            $preview = substr(preg_replace('/\s+/', ' ', $statement) ?? $statement, 0, 72);
            echo "  OK: {$preview}…\n";
        } catch (Throwable $e) {
            echo '  SKIP: ' . $e->getMessage() . "\n";
        }
    }
}

function postMigrateRoleTypes(PDO $pdo): void
{
    echo "\n── post: job_role_types catalog sync\n";
    if (!tableExists($pdo, 'job_role_types') || !tableExists($pdo, 'job_posts')) {
        echo "  SKIP: tables not present\n";
        return;
    }

    $posts = $pdo->query(
        'SELECT DISTINCT job_type FROM job_posts WHERE job_type IS NOT NULL AND job_type <> \'\''
    )->fetchAll(PDO::FETCH_COLUMN);

    foreach ($posts as $slug) {
        try {
            CareerService::ensureRoleTypeExists($pdo, (string) $slug);
            echo "  OK: role type {$slug}\n";
        } catch (Throwable $e) {
            echo "  SKIP {$slug}: {$e->getMessage()}\n";
        }
    }
}

function postMigrateEmployees(PDO $pdo): void
{
    echo "\n── post: workforce employee backfill (DPM-EMP-####)\n";
    if (!tableExists($pdo, 'employees')) {
        echo "  SKIP: employees table not present\n";
        return;
    }

    $count = EmployeeService::backfillExistingWorkforce($pdo);
    echo "  Backfilled {$count} employee record(s).\n";
}

function postMigrateLegalPolicies(PDO $pdo): void
{
    echo "\n── post: legal policies (storefront v2)\n";
    if (!tableExists($pdo, 'legal_policies')) {
        echo "  SKIP: legal_policies table not present\n";
        return;
    }

    try {
        $count = LegalPolicySeeder::seedStorefrontPolicies($pdo);
        echo "  OK: upserted {$count} policy document(s) from docs/legal/policies\n";
    } catch (Throwable $e) {
        echo '  SKIP: ' . $e->getMessage() . "\n";
    }
}

// ---------------------------------------------------------------------------

echo "DanyPathMart — migrate-all\n";
echo str_repeat('=', 50) . "\n";

$pdo = Database::pdo();

$users = $pdo->query("SHOW TABLES LIKE 'users'")->fetch();
if ($users === false) {
    fwrite(STDERR, "\nERROR: No `users` table. Import database/schema.sql and seed.sql first.\n\n");
    exit(1);
}

$migrationsDir = migrationsDir();
if ($migrationsDir === null) {
    fwrite(STDERR, "ERROR: No migration SQL files found.\n");
    fwrite(STDERR, "Upload database/migrations to public_html/database/migrations on the server.\n");
    exit(1);
}

$files = sortedMigrationSqlFiles();
if ($files === []) {
    fwrite(STDERR, "ERROR: No migration SQL files in {$migrationsDir}\n");
    exit(1);
}

echo "Migrations dir: {$migrationsDir}\n";
echo 'Found ' . count($files) . " migration file(s).\n";

foreach ($files as $file) {
    runSqlFile($pdo, $file);
}

postMigrateRoleTypes($pdo);
postMigrateEmployees($pdo);
postMigrateLegalPolicies($pdo);

echo "\n" . str_repeat('=', 50) . "\n";
echo "migrate-all complete.\n";
echo "Next: php backend/scripts/check-production-env.php (before production deploy)\n";
