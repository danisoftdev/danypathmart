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
                'slug'           => 'seller-handbook',
                'title'          => 'Seller handbook',
                'file'           => 'seller-handbook.md',
                'is_published'   => true,
                'show_in_footer' => false,
                'sort_order'     => 100,
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
            }
            $count++;
        }

        return $count;
    }

    private static function policiesDir(): ?string
    {
        foreach ([
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
