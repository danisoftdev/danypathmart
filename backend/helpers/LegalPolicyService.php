<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

final class LegalPolicyService
{
    /** @return list<array<string,mixed>> */
    public static function listFooter(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT slug, title FROM legal_policies
             WHERE is_published = 1 AND show_in_footer = 1
             ORDER BY sort_order ASC, id ASC'
        );

        return array_map(static fn (array $r): array => [
            'slug'  => (string) $r['slug'],
            'title' => (string) $r['title'],
        ], $stmt->fetchAll());
    }

    /** @return list<array<string,mixed>> */
    public static function listAll(PDO $pdo): array
    {
        $cols = self::selectColumns($pdo);
        $stmt = $pdo->query(
            "SELECT {$cols}
             FROM legal_policies
             ORDER BY sort_order ASC, id ASC"
        );

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    /** @return array<string,mixed>|null */
    public static function findPublishedBySlug(PDO $pdo, string $slug): ?array
    {
        $slug = self::normalizeSlug($slug);
        $cols = self::selectColumns($pdo);
        $stmt = $pdo->prepare(
            "SELECT {$cols}
             FROM legal_policies WHERE slug = ? AND is_published = 1 LIMIT 1"
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    /** @param array<string,mixed> $input */
    public static function create(PDO $pdo, array $input): array
    {
        $row = self::normalizeInput($input, $pdo, null);
        $pdo->prepare(
            'INSERT INTO legal_policies (slug, title, body, is_published, show_in_footer, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            $row['slug'],
            $row['title'],
            $row['body'],
            $row['is_published'],
            $row['show_in_footer'],
            $row['sort_order'],
        ]);

        return self::findById($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input */
    public static function update(PDO $pdo, int $id, array $input): array
    {
        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Policy not found.');
        }

        $row = self::normalizeInput($input, $pdo, $id);
        $pdo->prepare(
            'UPDATE legal_policies SET slug = ?, title = ?, body = ?, is_published = ?, show_in_footer = ?, sort_order = ? WHERE id = ?'
        )->execute([
            $row['slug'],
            $row['title'],
            $row['body'],
            $row['is_published'],
            $row['show_in_footer'],
            $row['sort_order'],
            $id,
        ]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function delete(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM legal_policies WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            throw new \InvalidArgumentException('Policy not found.');
        }
    }

    /** @return array<string,mixed>|null */
    public static function findById(PDO $pdo, int $id): ?array
    {
        $cols = self::selectColumns($pdo);
        $stmt = $pdo->prepare(
            "SELECT {$cols} FROM legal_policies WHERE id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        return $row !== false ? self::format($row) : null;
    }

    public static function hasAttachmentColumns(PDO $pdo): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        try {
            $pdo->query('SELECT attachment_path FROM legal_policies LIMIT 1');
            $cached = true;
        } catch (\Throwable) {
            $cached = false;
        }

        return $cached;
    }

    /**
     * Store a downloadable file (Word/PDF) for a policy. Requires manage_legal_policies at API layer.
     *
     * @param array<string,mixed> $file $_FILES entry
     * @return array<string,mixed>
     */
    public static function setAttachment(PDO $pdo, int $id, array $file): array
    {
        if (!self::hasAttachmentColumns($pdo)) {
            throw new \RuntimeException('Run migration 074_legal_policy_attachments.sql first.');
        }

        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Policy not found.');
        }

        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('No file uploaded.');
        }

        $origName = (string) ($file['name'] ?? 'handbook');
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed = ['pdf', 'doc', 'docx'];
        if (!in_array($ext, $allowed, true)) {
            throw new \InvalidArgumentException('Upload a PDF or Word file (.pdf, .doc, .docx).');
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > 15 * 1024 * 1024) {
            throw new \InvalidArgumentException('File must be under 15 MB.');
        }

        $dir = dirname(__DIR__) . '/uploads/legal';
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Could not create uploads/legal directory.');
        }

        $safeBase = preg_replace('/[^a-zA-Z0-9._-]+/', '-', pathinfo($origName, PATHINFO_FILENAME)) ?: 'policy';
        $filename = $id . '-' . substr(bin2hex(random_bytes(6)), 0, 12) . '-' . $safeBase . '.' . $ext;
        $abs = $dir . '/' . $filename;
        if (!move_uploaded_file((string) $file['tmp_name'], $abs)) {
            throw new \RuntimeException('Could not store uploaded file.');
        }

        self::deleteAttachmentFile($existing['attachment_path'] ?? null);

        $rel = '/uploads/legal/' . $filename;
        $displayName = trim($origName) !== '' ? $origName : ('policy.' . $ext);
        $pdo->prepare(
            'UPDATE legal_policies SET attachment_path = ?, attachment_name = ?, updated_at = NOW() WHERE id = ?'
        )->execute([$rel, $displayName, $id]);

        return self::findById($pdo, $id) ?? [];
    }

    public static function clearAttachment(PDO $pdo, int $id): array
    {
        if (!self::hasAttachmentColumns($pdo)) {
            throw new \RuntimeException('Run migration 074_legal_policy_attachments.sql first.');
        }

        $existing = self::findById($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Policy not found.');
        }

        self::deleteAttachmentFile($existing['attachment_path'] ?? null);
        $pdo->prepare(
            'UPDATE legal_policies SET attachment_path = NULL, attachment_name = NULL, updated_at = NOW() WHERE id = ?'
        )->execute([$id]);

        return self::findById($pdo, $id) ?? [];
    }

    private static function deleteAttachmentFile(?string $relPath): void
    {
        if ($relPath === null || $relPath === '') {
            return;
        }
        $abs = dirname(__DIR__) . $relPath;
        if (is_file($abs)) {
            @unlink($abs);
        }
    }

    private static function selectColumns(PDO $pdo): string
    {
        $base = 'id, slug, title, body, is_published, show_in_footer, sort_order, created_at, updated_at';
        if (self::hasAttachmentColumns($pdo)) {
            return $base . ', attachment_path, attachment_name';
        }

        return $base;
    }

    public static function countPublished(PDO $pdo): int
    {
        return (int) $pdo->query('SELECT COUNT(*) FROM legal_policies WHERE is_published = 1')->fetchColumn();
    }

    /** Published policies linked at checkout (returns, privacy, terms). */
    /** @return list<array{slug:string,title:string,path:string}> */
    public static function checkoutTrustLinks(PDO $pdo): array
    {
        $links = [];
        foreach (['returns', 'privacy', 'terms', 'payments'] as $slug) {
            $policy = self::findPublishedBySlug($pdo, $slug);
            if ($policy === null) {
                continue;
            }
            $links[] = [
                'slug'  => $slug,
                'title' => (string) $policy['title'],
                'path'  => '/policies/' . $slug,
            ];
        }

        return $links;
    }

    /** @param array<string,mixed> $input */
    private static function normalizeInput(array $input, PDO $pdo, ?int $excludeId): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        if ($title === '') {
            throw new \InvalidArgumentException('Title is required.');
        }

        $body = self::sanitizeBody((string) ($input['body'] ?? ''));
        $plainLen = strlen(trim(html_entity_decode(strip_tags($body), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        if ($plainLen < 20) {
            throw new \InvalidArgumentException('Policy body must be at least 20 characters.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title) ?? '');
            $slug = trim($slug, '-');
        }
        $slug = self::normalizeSlug($slug);

        $check = $pdo->prepare('SELECT id FROM legal_policies WHERE slug = ? AND id <> COALESCE(?, 0)');
        $check->execute([$slug, $excludeId ?? 0]);
        if ($check->fetch() !== false) {
            throw new \InvalidArgumentException('A policy with this slug already exists.');
        }

        return [
            'slug'            => $slug,
            'title'           => $title,
            'body'            => $body,
            'is_published'    => !empty($input['is_published']) ? 1 : 0,
            'show_in_footer'  => !array_key_exists('show_in_footer', $input) || !empty($input['show_in_footer']) ? 1 : 0,
            'sort_order'      => (int) ($input['sort_order'] ?? 0),
        ];
    }

    public static function normalizeSlug(string $slug): string
    {
        $slug = strtolower(trim($slug));
        $slug = preg_replace('/[^a-z0-9-]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        if ($slug === '') {
            throw new \InvalidArgumentException('Invalid policy slug.');
        }

        return $slug;
    }

    /**
     * Allow rich-text formatting (bold/italic/lists/headings) while stripping scripts and attributes.
     * Font is enforced in the frontend CSS (Times New Roman).
     */
    public static function sanitizeBody(string $body): string
    {
        $body = trim($body);
        if ($body === '') {
            return '';
        }

        // Legacy plain text — keep as-is (frontend renders paragraphs).
        if (!preg_match('/<\/?(?:p|br|strong|b|em|i|u|ol|ul|li|h[2-4])\b/i', $body)) {
            return $body;
        }

        $allowed = '<p><br><strong><b><em><i><u><ol><ul><li><h2><h3><h4>';
        $clean = strip_tags($body, $allowed);

        // Drop any leftover attributes (onclick, style, class, href, etc.).
        $clean = preg_replace('/<(p|br|strong|b|em|i|u|ol|ul|li|h2|h3|h4)(\s[^>]*)?>/i', '<$1>', $clean) ?? $clean;
        $clean = preg_replace('/<\/?(script|iframe|object|embed|link|meta|style)\b[^>]*>/i', '', $clean) ?? $clean;

        return trim($clean);
    }

    /** @param array<string,mixed> $row */
    private static function format(array $row): array
    {
        $out = [
            'id'              => (int) $row['id'],
            'slug'            => (string) $row['slug'],
            'title'           => (string) $row['title'],
            'body'            => (string) $row['body'],
            'is_published'    => (int) ($row['is_published'] ?? 0) === 1,
            'show_in_footer'  => (int) ($row['show_in_footer'] ?? 0) === 1,
            'sort_order'      => (int) ($row['sort_order'] ?? 0),
            'created_at'      => $row['created_at'] ?? null,
            'updated_at'      => $row['updated_at'] ?? null,
            'has_download'    => false,
            'attachment_name' => null,
            'download_path'   => null,
        ];

        $path = trim((string) ($row['attachment_path'] ?? ''));
        $name = trim((string) ($row['attachment_name'] ?? ''));
        if ($path !== '') {
            $out['has_download'] = true;
            $out['attachment_name'] = $name !== '' ? $name : basename($path);
            $out['download_path'] = '/public/legal-policies/' . $out['slug'] . '/download';
        }

        return $out;
    }
}
