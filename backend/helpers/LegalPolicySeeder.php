<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Seeds / updates CMS legal policies from docs/legal/policies/*.md */
final class LegalPolicySeeder
{
    /** @return list<array{slug:string,title:string,body:string,is_published:bool,show_in_footer:bool,sort_order:int}> */
    public static function definitions(): array
    {
        return [
            [
                'slug'           => 'terms',
                'title'          => 'Terms of service',
                'file'           => 'terms.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 10,
            ],
            [
                'slug'           => 'privacy',
                'title'          => 'Privacy policy',
                'file'           => 'privacy.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 20,
            ],
            [
                'slug'           => 'returns',
                'title'          => 'Returns & refunds',
                'file'           => 'returns.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 30,
            ],
            [
                'slug'           => 'payments',
                'title'          => 'Payment policy',
                'file'           => 'payments.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 35,
            ],
            [
                'slug'           => 'cookies',
                'title'          => 'Cookies policy',
                'file'           => 'cookies.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 40,
            ],
            [
                'slug'           => 'shop-seller-policy',
                'title'          => 'Shop seller policy',
                'file'           => 'shop-seller-policy.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 50,
            ],
            [
                'slug'           => 'acceptable-use',
                'title'          => 'Acceptable use',
                'file'           => 'acceptable-use.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 60,
            ],
            [
                'slug'           => 'complaints-disputes',
                'title'          => 'Complaints & disputes',
                'file'           => 'complaints-disputes.md',
                'is_published'   => true,
                'show_in_footer' => true,
                'sort_order'     => 70,
            ],
            [
                'slug'             => 'seller-handbook',
                'title'            => 'Seller handbook',
                'file'             => 'seller-handbook.md',
                'is_published'     => true,
                'show_in_footer'   => false,
                'sort_order'       => 100,
                'attachment_file'  => '09_Seller_Handbook.docx',
                'attachment_name'  => 'DanyPathMart_Seller_Handbook.docx',
            ],
        ];
    }

    /** Upsert all storefront v2 policies. Returns count updated/inserted. */
    public static function seedStorefrontPolicies(PDO $pdo): int
    {
        $count = 0;
        foreach (self::definitions() as $def) {
            $body = self::loadBody($def['file']);
            if ($body === null) {
                continue;
            }

            $stmt = $pdo->prepare('SELECT id FROM legal_policies WHERE slug = ? LIMIT 1');
            $stmt->execute([$def['slug']]);
            $existingId = $stmt->fetchColumn();

            if ($existingId !== false) {
                $pdo->prepare(
                    'UPDATE legal_policies SET title = ?, body = ?, is_published = ?, show_in_footer = ?, sort_order = ?, updated_at = NOW()
                     WHERE id = ?'
                )->execute([
                    $def['title'],
                    $body,
                    $def['is_published'] ? 1 : 0,
                    $def['show_in_footer'] ? 1 : 0,
                    $def['sort_order'],
                    (int) $existingId,
                ]);
                $policyId = (int) $existingId;
            } else {
                $pdo->prepare(
                    'INSERT INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?)'
                )->execute([
                    $def['slug'],
                    $def['title'],
                    $body,
                    $def['is_published'] ? 1 : 0,
                    $def['show_in_footer'] ? 1 : 0,
                    $def['sort_order'],
                ]);
                $policyId = (int) $pdo->lastInsertId();
            }

            self::syncBundledAttachment($pdo, $policyId, $def);
            $count++;
        }

        return $count;
    }

    /** @param array<string,mixed> $def */
    private static function syncBundledAttachment(PDO $pdo, int $policyId, array $def): void
    {
        $file = trim((string) ($def['attachment_file'] ?? ''));
        if ($file === '' || $policyId <= 0) {
            return;
        }

        $path = self::resolveWordPath($file);
        if ($path === null) {
            return;
        }

        try {
            LegalPolicyService::setAttachmentFromLocalFile(
                $pdo,
                $policyId,
                $path,
                (string) ($def['attachment_name'] ?? basename($path))
            );
        } catch (\Throwable $e) {
            // Non-fatal: policy body still seeded; attachment can be uploaded in admin.
            error_log('LegalPolicySeeder attachment skipped: ' . $e->getMessage());
        }
    }

    private static function policiesDir(): ?string
    {
        foreach ([
            // Deployed with backend on Hostinger (api/docs/legal/policies)
            __DIR__ . '/../docs/legal/policies',
            // Repo layout when running from a full checkout
            __DIR__ . '/../../docs/legal/policies',
            __DIR__ . '/../../../docs/legal/policies',
        ] as $dir) {
            $resolved = realpath($dir);
            if ($resolved !== false && is_dir($resolved)) {
                return $resolved;
            }
        }

        return null;
    }

    private static function resolveWordPath(string $filename): ?string
    {
        foreach ([
            __DIR__ . '/../docs/legal/word/' . $filename,
            __DIR__ . '/../../docs/legal/word/' . $filename,
            __DIR__ . '/../../../docs/legal/word/' . $filename,
            __DIR__ . '/../docs/legal/' . $filename,
            __DIR__ . '/../../docs/legal/' . $filename,
        ] as $path) {
            $resolved = realpath($path);
            if ($resolved !== false && is_file($resolved)) {
                return $resolved;
            }
        }

        return null;
    }

    private static function loadBody(string $filename): ?string
    {
        $dir = self::policiesDir();
        if ($dir === null) {
            return null;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) {
            return null;
        }
        $text = file_get_contents($path);

        return $text === false ? null : trim($text);
    }
}
