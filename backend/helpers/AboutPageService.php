<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;

/** Single-row About Us CMS + team members. */
final class AboutPageService
{
    public const TEAM_NAME_MAX = 60;
    public const TEAM_ROLE_MAX = 40;
    public const TEAM_BIO_MIN = 140;
    public const TEAM_BIO_MAX = 260;

    /** @return array<string,mixed> */
    public static function getAdmin(PDO $pdo): array
    {
        self::ensureRow($pdo);
        $row = $pdo->query('SELECT * FROM about_page WHERE id = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC);
        $page = self::formatPage($row ?: []);
        $page['team'] = self::listTeam($pdo, false);

        return $page;
    }

    /**
     * Public payload. When page is off, returns enabled=false and no sections.
     *
     * @return array{enabled:bool,page:?array<string,mixed>}
     */
    public static function getPublic(PDO $pdo): array
    {
        self::ensureRow($pdo);
        $row = $pdo->query('SELECT * FROM about_page WHERE id = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC);
        if ($row === false || !(int) ($row['page_enabled'] ?? 0)) {
            return ['enabled' => false, 'page' => null];
        }

        $page = self::formatPage($row);
        $page['team'] = self::listTeam($pdo, true);
        if (!(int) ($row['trusted_by_enabled'] ?? 0)) {
            $page['trusted_by_enabled'] = false;
            $page['trusted_by_items'] = [];
        }

        return ['enabled' => true, 'page' => $page];
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public static function update(PDO $pdo, array $input): array
    {
        self::ensureRow($pdo);

        $fields = [
            'page_enabled' => self::boolInt($input['page_enabled'] ?? false),
            'trusted_by_enabled' => self::boolInt($input['trusted_by_enabled'] ?? false),
            'trusted_by_heading' => self::str($input['trusted_by_heading'] ?? 'Trusted by', 255),
            'trusted_by_items' => self::encodeList($input['trusted_by_items'] ?? []),
            'hero_kicker' => self::str($input['hero_kicker'] ?? '', 120),
            'hero_title' => self::str($input['hero_title'] ?? 'DanyPathMart', 255, true),
            'hero_subtitle' => self::text($input['hero_subtitle'] ?? ''),
            'hero_cta_label' => self::str($input['hero_cta_label'] ?? 'Shop now', 80),
            'hero_cta_link' => self::str($input['hero_cta_link'] ?? '/shop', 255),
            'hero_secondary_label' => self::str($input['hero_secondary_label'] ?? '', 80),
            'hero_secondary_link' => self::str($input['hero_secondary_link'] ?? '', 255),
            'story_heading' => self::str($input['story_heading'] ?? 'Our story', 255),
            'story_body' => self::text($input['story_body'] ?? ''),
            'what_we_do_heading' => self::str($input['what_we_do_heading'] ?? 'What we do', 255),
            'what_we_do_intro' => self::text($input['what_we_do_intro'] ?? ''),
            'what_we_do_items' => self::encodeList($input['what_we_do_items'] ?? []),
            'who_we_serve_heading' => self::str($input['who_we_serve_heading'] ?? 'Who we serve', 255),
            'who_we_serve_intro' => self::text($input['who_we_serve_intro'] ?? ''),
            'who_we_serve_items' => self::encodeList($input['who_we_serve_items'] ?? []),
            'team_heading' => self::str($input['team_heading'] ?? 'Our team', 255),
            'team_intro' => self::text($input['team_intro'] ?? ''),
            'dsd_heading' => self::str($input['dsd_heading'] ?? 'Part of DSD Groups', 255),
            'dsd_intro' => self::text($input['dsd_intro'] ?? ''),
            'dsd_vision' => self::text($input['dsd_vision'] ?? ''),
            'dsd_mission' => self::text($input['dsd_mission'] ?? ''),
            'dsd_values' => self::encodeList($input['dsd_values'] ?? []),
            'cta_heading' => self::str($input['cta_heading'] ?? 'Ready to get started?', 255),
            'cta_body' => self::text($input['cta_body'] ?? ''),
            'cta_primary_label' => self::str($input['cta_primary_label'] ?? 'Shop now', 80),
            'cta_primary_link' => self::str($input['cta_primary_link'] ?? '/shop', 255),
            'cta_secondary_label' => self::str($input['cta_secondary_label'] ?? '', 80),
            'cta_secondary_link' => self::str($input['cta_secondary_link'] ?? '', 255),
            'seo_title' => self::str($input['seo_title'] ?? 'About us | DanyPathMart', 255),
            'seo_description' => self::str($input['seo_description'] ?? '', 500),
        ];

        $sets = [];
        $vals = [];
        foreach ($fields as $col => $val) {
            $sets[] = "{$col} = ?";
            $vals[] = $val;
        }
        $vals[] = 1;
        $pdo->prepare('UPDATE about_page SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);

        return self::getAdmin($pdo);
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public static function createTeamMember(PDO $pdo, array $input): array
    {
        $name = self::str($input['name'] ?? '', self::TEAM_NAME_MAX, true);
        $role = self::str($input['role_title'] ?? '', self::TEAM_ROLE_MAX);
        $bio = self::teamBio($input['bio'] ?? '', (bool) ($input['is_visible'] ?? true));
        $photo = self::str($input['photo_url'] ?? '', 500);
        $linkedin = self::str($input['linkedin_url'] ?? '', 500);
        $website = self::str($input['website_url'] ?? '', 500);
        $sort = (int) ($input['sort_order'] ?? 0);
        $visible = self::boolInt($input['is_visible'] ?? true);

        if (self::hasSocialColumns($pdo)) {
            $pdo->prepare(
                'INSERT INTO about_team_members (name, role_title, bio, photo_url, linkedin_url, website_url, sort_order, is_visible)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([$name, $role, $bio, $photo, $linkedin, $website, $sort, $visible]);
        } else {
            $pdo->prepare(
                'INSERT INTO about_team_members (name, role_title, bio, photo_url, sort_order, is_visible)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$name, $role, $bio, $photo, $sort, $visible]);
        }

        return self::findTeamMember($pdo, (int) $pdo->lastInsertId()) ?? [];
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public static function updateTeamMember(PDO $pdo, int $id, array $input): array
    {
        $existing = self::findTeamMember($pdo, $id);
        if ($existing === null) {
            throw new \InvalidArgumentException('Team member not found.');
        }

        $name = array_key_exists('name', $input) ? self::str($input['name'], self::TEAM_NAME_MAX, true) : $existing['name'];
        $role = array_key_exists('role_title', $input) ? self::str($input['role_title'], self::TEAM_ROLE_MAX) : $existing['role_title'];
        $visible = array_key_exists('is_visible', $input) ? self::boolInt($input['is_visible']) : (int) $existing['is_visible'];
        $bio = array_key_exists('bio', $input)
            ? self::teamBio($input['bio'], (bool) $visible)
            : self::teamBio($existing['bio'] ?? '', (bool) $visible);
        $photo = array_key_exists('photo_url', $input) ? self::str($input['photo_url'], 500) : ($existing['photo_url'] ?? '');
        $linkedin = array_key_exists('linkedin_url', $input) ? self::str($input['linkedin_url'], 500) : ($existing['linkedin_url'] ?? '');
        $website = array_key_exists('website_url', $input) ? self::str($input['website_url'], 500) : ($existing['website_url'] ?? '');
        $sort = array_key_exists('sort_order', $input) ? (int) $input['sort_order'] : (int) $existing['sort_order'];

        if (self::hasSocialColumns($pdo)) {
            $pdo->prepare(
                'UPDATE about_team_members
                 SET name = ?, role_title = ?, bio = ?, photo_url = ?, linkedin_url = ?, website_url = ?,
                     sort_order = ?, is_visible = ?, updated_at = NOW()
                 WHERE id = ?'
            )->execute([$name, $role, $bio, $photo, $linkedin, $website, $sort, $visible, $id]);
        } else {
            $pdo->prepare(
                'UPDATE about_team_members
                 SET name = ?, role_title = ?, bio = ?, photo_url = ?, sort_order = ?, is_visible = ?, updated_at = NOW()
                 WHERE id = ?'
            )->execute([$name, $role, $bio, $photo, $sort, $visible, $id]);
        }

        return self::findTeamMember($pdo, $id) ?? [];
    }

    public static function deleteTeamMember(PDO $pdo, int $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM about_team_members WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            throw new \InvalidArgumentException('Team member not found.');
        }
    }

    /** @return list<array<string,mixed>> */
    public static function listTeam(PDO $pdo, bool $visibleOnly): array
    {
        $cols = self::teamSelectColumns($pdo);
        $sql = "SELECT {$cols} FROM about_team_members";
        if ($visibleOnly) {
            $sql .= ' WHERE is_visible = 1';
        }
        $sql .= ' ORDER BY sort_order ASC, id ASC';
        $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map([self::class, 'formatTeam'], $rows);
    }

    /** @return array<string,mixed>|null */
    public static function findTeamMember(PDO $pdo, int $id): ?array
    {
        $cols = self::teamSelectColumns($pdo);
        $stmt = $pdo->prepare("SELECT {$cols} FROM about_team_members WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row !== false ? self::formatTeam($row) : null;
    }

    private static function teamSelectColumns(PDO $pdo): string
    {
        $base = 'id, name, role_title, bio, photo_url, sort_order, is_visible, created_at, updated_at';
        if (self::hasSocialColumns($pdo)) {
            return $base . ', linkedin_url, website_url';
        }

        return $base;
    }

    private static function hasSocialColumns(PDO $pdo): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        try {
            $pdo->query('SELECT linkedin_url FROM about_team_members LIMIT 1');
            $cached = true;
        } catch (\Throwable) {
            $cached = false;
        }

        return $cached;
    }

    private static function ensureRow(PDO $pdo): void
    {
        AboutPageSeeder::seedDefaults($pdo);
        $exists = (int) $pdo->query('SELECT COUNT(*) FROM about_page WHERE id = 1')->fetchColumn();
        if ($exists > 0) {
            return;
        }
        $pdo->exec('INSERT INTO about_page (id, page_enabled, hero_title) VALUES (1, 0, \'DanyPathMart\')');
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function formatPage(array $row): array
    {
        return [
            'page_enabled' => (bool) (int) ($row['page_enabled'] ?? 0),
            'trusted_by_enabled' => (bool) (int) ($row['trusted_by_enabled'] ?? 0),
            'trusted_by_heading' => (string) ($row['trusted_by_heading'] ?? 'Trusted by'),
            'trusted_by_items' => self::decodeList($row['trusted_by_items'] ?? null),
            'hero_kicker' => (string) ($row['hero_kicker'] ?? ''),
            'hero_title' => (string) ($row['hero_title'] ?? 'DanyPathMart'),
            'hero_subtitle' => (string) ($row['hero_subtitle'] ?? ''),
            'hero_cta_label' => (string) ($row['hero_cta_label'] ?? 'Shop now'),
            'hero_cta_link' => (string) ($row['hero_cta_link'] ?? '/shop'),
            'hero_secondary_label' => (string) ($row['hero_secondary_label'] ?? ''),
            'hero_secondary_link' => (string) ($row['hero_secondary_link'] ?? ''),
            'story_heading' => (string) ($row['story_heading'] ?? 'Our story'),
            'story_body' => (string) ($row['story_body'] ?? ''),
            'what_we_do_heading' => (string) ($row['what_we_do_heading'] ?? 'What we do'),
            'what_we_do_intro' => (string) ($row['what_we_do_intro'] ?? ''),
            'what_we_do_items' => self::decodeList($row['what_we_do_items'] ?? null),
            'who_we_serve_heading' => (string) ($row['who_we_serve_heading'] ?? 'Who we serve'),
            'who_we_serve_intro' => (string) ($row['who_we_serve_intro'] ?? ''),
            'who_we_serve_items' => self::decodeList($row['who_we_serve_items'] ?? null),
            'team_heading' => (string) ($row['team_heading'] ?? 'Our team'),
            'team_intro' => (string) ($row['team_intro'] ?? ''),
            'dsd_heading' => (string) ($row['dsd_heading'] ?? 'Part of DSD Groups'),
            'dsd_intro' => (string) ($row['dsd_intro'] ?? ''),
            'dsd_vision' => (string) ($row['dsd_vision'] ?? ''),
            'dsd_mission' => (string) ($row['dsd_mission'] ?? ''),
            'dsd_values' => self::decodeList($row['dsd_values'] ?? null),
            'cta_heading' => (string) ($row['cta_heading'] ?? 'Ready to get started?'),
            'cta_body' => (string) ($row['cta_body'] ?? ''),
            'cta_primary_label' => (string) ($row['cta_primary_label'] ?? 'Shop now'),
            'cta_primary_link' => (string) ($row['cta_primary_link'] ?? '/shop'),
            'cta_secondary_label' => (string) ($row['cta_secondary_label'] ?? ''),
            'cta_secondary_link' => (string) ($row['cta_secondary_link'] ?? ''),
            'seo_title' => (string) ($row['seo_title'] ?? 'About us | DanyPathMart'),
            'seo_description' => (string) ($row['seo_description'] ?? ''),
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function formatTeam(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'role_title' => (string) ($row['role_title'] ?? ''),
            'bio' => (string) ($row['bio'] ?? ''),
            'photo_url' => (string) ($row['photo_url'] ?? ''),
            'linkedin_url' => (string) ($row['linkedin_url'] ?? ''),
            'website_url' => (string) ($row['website_url'] ?? ''),
            'sort_order' => (int) ($row['sort_order'] ?? 0),
            'is_visible' => (bool) (int) ($row['is_visible'] ?? 0),
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /** @return list<array<string,string>> */
    private static function decodeList(mixed $raw): array
    {
        if (is_array($raw)) {
            return self::normalizeList($raw);
        }
        $text = trim((string) ($raw ?? ''));
        if ($text === '') {
            return [];
        }
        $decoded = json_decode($text, true);
        if (!is_array($decoded)) {
            return [];
        }

        return self::normalizeList($decoded);
    }

    /** @param mixed $items */
    private static function encodeList(mixed $items): string
    {
        return json_encode(self::normalizeList(is_array($items) ? $items : []), JSON_UNESCAPED_UNICODE) ?: '[]';
    }

    /**
     * @param list<mixed> $items
     * @return list<array{title?:string,body?:string,label?:string,value?:string}>
     */
    private static function normalizeList(array $items): array
    {
        $out = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $title = trim((string) ($item['title'] ?? $item['label'] ?? ''));
            $body = trim((string) ($item['body'] ?? $item['value'] ?? ''));
            if ($title === '' && $body === '') {
                continue;
            }
            $row = [];
            if (isset($item['label']) || isset($item['value'])) {
                $row['label'] = $title;
                $row['value'] = $body;
            } else {
                $row['title'] = $title;
                $row['body'] = $body;
            }
            $out[] = $row;
            if (count($out) >= 20) {
                break;
            }
        }

        return $out;
    }

    private static function boolInt(mixed $v): int
    {
        return filter_var($v, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    }

    private static function str(mixed $v, int $max, bool $required = false): string
    {
        $s = trim((string) $v);
        if ($required && $s === '') {
            throw new \InvalidArgumentException('A required text field is missing.');
        }
        if (strlen($s) > $max) {
            $s = substr($s, 0, $max);
        }

        return $s;
    }

    private static function teamBio(mixed $v, bool $requireLength): string
    {
        $s = trim((string) $v);
        $len = mb_strlen($s);
        if ($s === '') {
            if ($requireLength) {
                throw new \InvalidArgumentException(
                    'Bio is required for visible team cards (' . self::TEAM_BIO_MIN . '–' . self::TEAM_BIO_MAX . ' characters).'
                );
            }

            return '';
        }
        if ($len < self::TEAM_BIO_MIN) {
            throw new \InvalidArgumentException(
                'Bio must be at least ' . self::TEAM_BIO_MIN . ' characters (now ' . $len . ') so cards stay even.'
            );
        }
        if ($len > self::TEAM_BIO_MAX) {
            throw new \InvalidArgumentException(
                'Bio must be at most ' . self::TEAM_BIO_MAX . ' characters (now ' . $len . ') so cards stay even.'
            );
        }

        return $s;
    }

    private static function text(mixed $v): string
    {
        $s = trim((string) $v);
        if (strlen($s) > 20000) {
            $s = substr($s, 0, 20000);
        }

        return $s;
    }
}
