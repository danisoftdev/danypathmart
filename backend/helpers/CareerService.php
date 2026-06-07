<?php

declare(strict_types=1);

namespace App\Helpers;

use PDO;
use finfo;

/** Job posts, custom application fields, and careers applications (Phase M2+). */
final class CareerService
{
    /** Built-in slugs used for description templates (legacy). */
    public const BUILTIN_ROLE_SLUGS = ['driver', 'warehouse', 'station_coordinator'];

    /** @var list<string> */
    public const FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'number', 'select', 'file', 'url', 'date'];

    /** @var array<string, string> */
    private const FILE_MIMES = [
        'pdf'  => 'application/pdf',
        'doc'  => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
    ];

    public static function isValidFieldType(string $type): bool
    {
        return in_array($type, self::FIELD_TYPES, true);
    }

    public static function slugifyRoleType(string $input): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim($input)) ?? '');
        $slug = trim($slug, '_');
        return $slug !== '' ? $slug : 'role';
    }

    /**
     * @return list<array{slug: string, label: string, is_driver: bool}>
     */
    public static function listRoleTypes(PDO $pdo): array
    {
        try {
            $rows = $pdo->query(
                'SELECT slug, label, is_driver FROM job_role_types ORDER BY label ASC'
            )->fetchAll();
        } catch (\Throwable) {
            return [
                ['slug' => 'driver', 'label' => 'Delivery driver', 'is_driver' => true],
                ['slug' => 'warehouse', 'label' => 'Warehouse assistant', 'is_driver' => false],
                ['slug' => 'station_coordinator', 'label' => 'Pickup station coordinator', 'is_driver' => false],
            ];
        }

        return array_map(static fn (array $r): array => [
            'slug'      => (string) $r['slug'],
            'label'     => (string) $r['label'],
            'is_driver' => (int) ($r['is_driver'] ?? 0) === 1,
        ], $rows);
    }

    /**
     * Resolve typed/selected role to a catalog slug — creates new types automatically.
     *
     * @return array{slug: string, label: string, is_driver: bool}
     */
    public static function resolveRoleType(PDO $pdo, string $input): array
    {
        $input = trim($input);
        if ($input === '') {
            throw new \InvalidArgumentException('Role type is required.');
        }

        self::ensureRoleTypesTable($pdo);

        $bySlug = $pdo->prepare('SELECT slug, label, is_driver FROM job_role_types WHERE slug = ? LIMIT 1');
        $bySlug->execute([self::slugifyRoleType($input)]);
        $row = $bySlug->fetch();
        if ($row !== false) {
            return self::formatRoleTypeRow($row);
        }

        $byLabel = $pdo->prepare(
            'SELECT slug, label, is_driver FROM job_role_types WHERE LOWER(label) = LOWER(?) LIMIT 1'
        );
        $byLabel->execute([$input]);
        $row = $byLabel->fetch();
        if ($row !== false) {
            return self::formatRoleTypeRow($row);
        }

        $slug = self::uniqueRoleSlug($pdo, self::slugifyRoleType($input));
        $label = $input;
        $isDriver = $slug === 'driver' ? 1 : 0;

        $pdo->prepare(
            'INSERT INTO job_role_types (slug, label, is_driver) VALUES (?, ?, ?)'
        )->execute([$slug, $label, $isDriver]);

        return [
            'slug'      => $slug,
            'label'     => $label,
            'is_driver' => $isDriver === 1,
        ];
    }

    /** Register slug from an existing job post if missing from catalog. */
    public static function ensureRoleTypeExists(PDO $pdo, string $slugOrLabel): void
    {
        self::ensureRoleTypesTable($pdo);
        try {
            self::resolveRoleType($pdo, $slugOrLabel);
        } catch (\InvalidArgumentException) {
            /* ignore */
        }
    }

    public static function isDriverRole(PDO $pdo, string $slug): bool
    {
        self::ensureRoleTypesTable($pdo);
        $stmt = $pdo->prepare('SELECT is_driver FROM job_role_types WHERE slug = ? LIMIT 1');
        $stmt->execute([$slug]);
        $val = $stmt->fetchColumn();
        if ($val === false) {
            return $slug === 'driver';
        }

        return (int) $val === 1;
    }

    public static function isStationRole(PDO $pdo, string $slug): bool
    {
        return $slug === 'station_coordinator';
    }

    public static function jobTypeLabel(PDO $pdo, string $slug): string
    {
        self::ensureRoleTypesTable($pdo);
        $stmt = $pdo->prepare('SELECT label FROM job_role_types WHERE slug = ? LIMIT 1');
        $stmt->execute([$slug]);
        $label = $stmt->fetchColumn();
        if ($label !== false && $label !== '') {
            return (string) $label;
        }

        return ucwords(str_replace('_', ' ', $slug));
    }

    /** @deprecated Use jobTypeLabel($pdo, $slug) — kept for static fallback */
    public static function jobTypeLabelFallback(string $slug): string
    {
        return match ($slug) {
            'driver'               => 'Delivery driver',
            'warehouse'            => 'Warehouse assistant',
            'station_coordinator'  => 'Pickup station coordinator',
            default                => ucwords(str_replace('_', ' ', $slug)),
        };
    }

    public static function driverRoleNote(): string
    {
        return 'Hub ↔ pickup station runs only. No home delivery and no cash handling.';
    }

    public static function postsSelectColumns(string $prefix = 'p'): string
    {
        return "{$prefix}.id, {$prefix}.title, {$prefix}.city, {$prefix}.job_type, {$prefix}.description,
                {$prefix}.is_active, {$prefix}.created_at, {$prefix}.updated_at,
                r.label AS job_type_label, r.is_driver AS job_type_is_driver";
    }

    public static function postsFromJoin(): string
    {
        return 'job_posts p LEFT JOIN job_role_types r ON r.slug = p.job_type';
    }

    /** @return list<array<string, mixed>> */
    public static function defaultFieldDefinitions(): array
    {
        return [
            [
                'field_key'           => 'full_name',
                'label'               => 'Full name',
                'field_type'          => 'text',
                'is_required'         => true,
                'sort_order'          => 1,
                'placeholder'         => 'Your full name',
                'help_text'           => null,
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
            [
                'field_key'           => 'email',
                'label'               => 'Email address',
                'field_type'          => 'email',
                'is_required'         => true,
                'sort_order'          => 2,
                'placeholder'         => 'you@example.com',
                'help_text'           => null,
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
            [
                'field_key'           => 'phone',
                'label'               => 'Phone number',
                'field_type'          => 'phone',
                'is_required'         => true,
                'sort_order'          => 3,
                'placeholder'         => '+233 …',
                'help_text'           => null,
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
            [
                'field_key'           => 'city',
                'label'               => 'City / area',
                'field_type'          => 'text',
                'is_required'         => false,
                'sort_order'          => 4,
                'placeholder'         => 'e.g. Accra',
                'help_text'           => null,
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
            [
                'field_key'           => 'cv',
                'label'               => 'CV / Résumé',
                'field_type'          => 'file',
                'is_required'         => false,
                'sort_order'          => 5,
                'placeholder'         => null,
                'help_text'           => 'PDF or Word document, max 5MB.',
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
            [
                'field_key'           => 'cover_letter',
                'label'               => 'Cover letter / message',
                'field_type'          => 'textarea',
                'is_required'         => false,
                'sort_order'          => 6,
                'placeholder'         => 'Tell us about your experience and availability…',
                'help_text'           => null,
                'options'             => [],
                'max_file_mb'         => 5,
                'accepted_extensions' => 'pdf,doc,docx',
            ],
        ];
    }

    public static function insertDefaultFields(PDO $pdo, int $jobPostId): void
    {
        self::syncFields($pdo, $jobPostId, self::defaultFieldDefinitions());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function loadFieldsForPost(PDO $pdo, int $jobPostId): array
    {
        $stmt = $pdo->prepare(
            'SELECT id, job_post_id, field_key, label, field_type, is_required, sort_order,
                    placeholder, help_text, options_json, max_file_mb, accepted_extensions
             FROM job_post_fields
             WHERE job_post_id = ?
             ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([$jobPostId]);

        return array_map(
            static fn (array $row): array => self::formatField($row),
            $stmt->fetchAll()
        );
    }

    /**
     * @param list<array<string, mixed>> $fields
     */
    public static function syncFields(PDO $pdo, int $jobPostId, array $fields): void
    {
        if ($fields === []) {
            throw new \InvalidArgumentException('At least one application field is required.');
        }

        $keys = [];
        foreach ($fields as $i => $field) {
            $label = trim((string) ($field['label'] ?? ''));
            $type = trim((string) ($field['field_type'] ?? 'text'));
            if ($label === '') {
                throw new \InvalidArgumentException('Each field needs a label.');
            }
            if (!self::isValidFieldType($type)) {
                throw new \InvalidArgumentException("Invalid field type: {$type}");
            }

            $key = trim((string) ($field['field_key'] ?? ''));
            if ($key === '') {
                $key = self::slugify($label);
            }
            $base = $key;
            $n = 2;
            while (isset($keys[$key])) {
                $key = $base . '_' . $n;
                $n++;
            }
            $keys[$key] = true;
            $fields[$i]['field_key'] = $key;
        }

        $pdo->prepare('DELETE FROM job_post_fields WHERE job_post_id = ?')->execute([$jobPostId]);

        $insert = $pdo->prepare(
            'INSERT INTO job_post_fields
                (job_post_id, field_key, label, field_type, is_required, sort_order,
                 placeholder, help_text, options_json, max_file_mb, accepted_extensions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        foreach ($fields as $i => $field) {
            $options = $field['options'] ?? [];
            if (is_string($options)) {
                $options = array_values(array_filter(array_map('trim', explode(',', $options))));
            }
            if (!is_array($options)) {
                $options = [];
            }

            $insert->execute([
                $jobPostId,
                $field['field_key'],
                trim((string) $field['label']),
                $field['field_type'],
                !empty($field['is_required']) ? 1 : 0,
                (int) ($field['sort_order'] ?? ($i + 1)),
                self::nullIfEmpty($field['placeholder'] ?? null),
                self::nullIfEmpty($field['help_text'] ?? null),
                $options !== [] ? json_encode(array_values($options), JSON_UNESCAPED_UNICODE) : null,
                max(1, min(20, (int) ($field['max_file_mb'] ?? 5))),
                self::normalizeExtensions((string) ($field['accepted_extensions'] ?? 'pdf,doc,docx')),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public static function formatField(array $row): array
    {
        $options = [];
        if (!empty($row['options_json'])) {
            $decoded = json_decode((string) $row['options_json'], true);
            if (is_array($decoded)) {
                $options = array_values(array_filter(array_map('strval', $decoded)));
            }
        }

        return [
            'id'                  => (int) $row['id'],
            'job_post_id'         => (int) $row['job_post_id'],
            'field_key'           => $row['field_key'],
            'label'               => $row['label'],
            'field_type'          => $row['field_type'],
            'is_required'         => (bool) ($row['is_required'] ?? false),
            'sort_order'          => (int) ($row['sort_order'] ?? 0),
            'placeholder'         => $row['placeholder'],
            'help_text'           => $row['help_text'],
            'options'             => $options,
            'max_file_mb'         => (int) ($row['max_file_mb'] ?? 5),
            'accepted_extensions' => $row['accepted_extensions'] ?? 'pdf,doc,docx',
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param list<array<string, mixed>> $fields
     * @param ?PDO $pdo
     * @return array<string, mixed>
     */
    public static function formatJobPost(array $row, array $fields = [], ?PDO $pdo = null): array
    {
        $type = (string) ($row['job_type'] ?? 'warehouse');
        $label = $row['job_type_label'] ?? null;
        $isDriver = array_key_exists('job_type_is_driver', $row)
            ? (int) ($row['job_type_is_driver'] ?? 0) === 1
            : ($pdo !== null ? self::isDriverRole($pdo, $type) : $type === 'driver');

        if ($label === null || $label === '') {
            $label = $pdo !== null
                ? self::jobTypeLabel($pdo, $type)
                : self::jobTypeLabelFallback($type);
        }

        return [
            'id'               => (int) $row['id'],
            'title'            => $row['title'],
            'city'             => $row['city'],
            'job_type'         => $type,
            'job_type_label'   => (string) $label,
            'is_driver_role'   => $isDriver,
            'description'      => $row['description'],
            'is_active'        => (bool) ($row['is_active'] ?? false),
            'created_at'       => $row['created_at'] ?? null,
            'updated_at'       => $row['updated_at'] ?? null,
            'fields'           => $fields,
        ];
    }

    private static function ensureRoleTypesTable(PDO $pdo): void
    {
        static $checked = false;
        if ($checked) {
            return;
        }
        $checked = true;
        try {
            $pdo->query('SELECT 1 FROM job_role_types LIMIT 1');
        } catch (\Throwable) {
            /* table may not exist until migration */
        }
    }

    /** @param array<string, mixed> $row */
    private static function formatRoleTypeRow(array $row): array
    {
        return [
            'slug'      => (string) $row['slug'],
            'label'     => (string) $row['label'],
            'is_driver' => (int) ($row['is_driver'] ?? 0) === 1,
        ];
    }

    private static function uniqueRoleSlug(PDO $pdo, string $base): string
    {
        $slug = $base;
        $n = 2;
        $check = $pdo->prepare('SELECT COUNT(*) FROM job_role_types WHERE slug = ?');
        while (true) {
            $check->execute([$slug]);
            if ((int) $check->fetchColumn() === 0) {
                return $slug;
            }
            $slug = $base . '_' . $n;
            $n++;
        }
    }

    /**
     * @param list<array<string, mixed>> $fields
     * @return array{responses: list<array<string, mixed>>, summary: array{name: string, email: string, phone: string, city: ?string, cover_message: ?string}}
     */
    public static function validateAndCollectResponses(PDO $pdo, int $jobPostId, array $fields): array
    {
        $responses = [];
        $summary = [
            'name'          => '',
            'email'         => '',
            'phone'         => '',
            'city'          => null,
            'cover_message' => null,
        ];

        foreach ($fields as $field) {
            $fieldId = (int) $field['id'];
            $type = (string) $field['field_type'];
            $key = (string) $field['field_key'];
            $label = (string) $field['label'];
            $required = (bool) $field['is_required'];

            $valueText = null;
            $filePath = null;
            $fileName = null;

            if ($type === 'file') {
                $fileKey = 'field_' . $fieldId;
                $file = $_FILES[$fileKey] ?? null;
                $hasFile = is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK;

                if (!$hasFile) {
                    if ($required) {
                        throw new \InvalidArgumentException("{$label} is required.");
                    }
                    continue;
                }

                [$filePath, $fileName] = self::storeApplicationFile($file, $field);
            } else {
                $raw = trim((string) ($_POST['field_' . $fieldId] ?? ''));
                if ($raw === '') {
                    if ($required) {
                        throw new \InvalidArgumentException("{$label} is required.");
                    }
                    continue;
                }

                self::validateTextValue($type, $raw, $label, $field);
                $valueText = $raw;
            }

            $responses[] = [
                'field_id'    => $fieldId,
                'field_key'   => $key,
                'field_label' => $label,
                'field_type'  => $type,
                'value_text'  => $valueText,
                'file_path'   => $filePath,
                'file_name'   => $fileName,
            ];

            if ($key === 'full_name' || $key === 'name') {
                $summary['name'] = (string) $valueText;
            } elseif ($key === 'email') {
                $summary['email'] = (string) $valueText;
            } elseif ($key === 'phone') {
                $summary['phone'] = (string) $valueText;
            } elseif ($key === 'city') {
                $summary['city'] = $valueText;
            } elseif ($key === 'cover_letter' || $key === 'cover_message') {
                $summary['cover_message'] = $valueText;
            }
        }

        if ($summary['name'] === '' || $summary['email'] === '' || $summary['phone'] === '') {
            foreach ($responses as $resp) {
                if ($summary['name'] === '' && $resp['field_type'] === 'text' && str_contains(strtolower($resp['field_label']), 'name')) {
                    $summary['name'] = (string) $resp['value_text'];
                }
                if ($summary['email'] === '' && $resp['field_type'] === 'email') {
                    $summary['email'] = (string) $resp['value_text'];
                }
                if ($summary['phone'] === '' && $resp['field_type'] === 'phone') {
                    $summary['phone'] = (string) $resp['value_text'];
                }
            }
        }

        if ($summary['name'] === '') {
            throw new \InvalidArgumentException('Please provide your name (add a required name field).');
        }
        if ($summary['email'] === '' || !Validator::email($summary['email'])) {
            throw new \InvalidArgumentException('Please provide a valid email address.');
        }
        if ($summary['phone'] === '') {
            throw new \InvalidArgumentException('Please provide a phone number.');
        }

        return ['responses' => $responses, 'summary' => $summary];
    }

    /**
     * @param list<array<string, mixed>> $responses
     */
    public static function saveResponses(PDO $pdo, int $applicationId, array $responses): void
    {
        $stmt = $pdo->prepare(
            'INSERT INTO job_application_responses
                (application_id, field_id, field_key, field_label, field_type, value_text, file_path, file_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        foreach ($responses as $resp) {
            $stmt->execute([
                $applicationId,
                $resp['field_id'],
                $resp['field_key'],
                $resp['field_label'],
                $resp['field_type'],
                $resp['value_text'],
                $resp['file_path'],
                $resp['file_name'],
            ]);
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function loadResponsesForApplication(PDO $pdo, int $applicationId): array
    {
        $stmt = $pdo->prepare(
            'SELECT id, field_id, field_key, field_label, field_type, value_text, file_path, file_name, created_at
             FROM job_application_responses
             WHERE application_id = ?
             ORDER BY id ASC'
        );
        $stmt->execute([$applicationId]);

        return array_map(static fn (array $r): array => [
            'id'          => (int) $r['id'],
            'field_id'    => $r['field_id'] !== null ? (int) $r['field_id'] : null,
            'field_key'   => $r['field_key'],
            'field_label' => $r['field_label'],
            'field_type'  => $r['field_type'],
            'value_text'  => $r['value_text'],
            'file_path'   => $r['file_path'],
            'file_name'   => $r['file_name'],
            'created_at'  => $r['created_at'],
        ], $stmt->fetchAll());
    }

    /**
     * @param array<string, mixed> $field
     * @return array{0: string, 1: string}
     */
    private static function storeApplicationFile(array $file, array $field): array
    {
        $maxMb = max(1, min(20, (int) ($field['max_file_mb'] ?? 5)));
        if ((int) $file['size'] > $maxMb * 1024 * 1024) {
            throw new \InvalidArgumentException("{$field['label']} must be {$maxMb}MB or smaller.");
        }

        $allowedExts = self::parseExtensions((string) ($field['accepted_extensions'] ?? 'pdf,doc,docx'));
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($file['tmp_name']);
        $ext = self::extensionFromMime($mime, $allowedExts, (string) ($file['name'] ?? ''));
        if ($ext === null) {
            $allowedLabel = implode(', ', $allowedExts);
            throw new \InvalidArgumentException("{$field['label']}: upload {$allowedLabel} only.");
        }

        $backendDir = dirname(__DIR__);
        $dir = $backendDir . '/uploads/careers';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $ext;
        $absPath = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $absPath)) {
            throw new \RuntimeException('Could not store uploaded file.');
        }

        $originalName = basename((string) ($file['name'] ?? $filename));

        return ['/uploads/careers/' . $filename, $originalName];
    }

    /**
     * @param array<string, mixed> $field
     */
    private static function validateTextValue(string $type, string $value, string $label, array $field): void
    {
        if (strlen($value) > 10000) {
            throw new \InvalidArgumentException("{$label} is too long.");
        }

        switch ($type) {
            case 'email':
                if (!Validator::email($value)) {
                    throw new \InvalidArgumentException("Please enter a valid email for {$label}.");
                }
                break;
            case 'phone':
                if (strlen(preg_replace('/\D/', '', $value) ?? '') < 8) {
                    throw new \InvalidArgumentException("Please enter a valid phone number for {$label}.");
                }
                break;
            case 'number':
                if (!is_numeric($value)) {
                    throw new \InvalidArgumentException("{$label} must be a number.");
                }
                break;
            case 'url':
                if (!filter_var($value, FILTER_VALIDATE_URL)) {
                    throw new \InvalidArgumentException("Please enter a valid URL for {$label}.");
                }
                break;
            case 'select':
                $options = $field['options'] ?? [];
                if (is_array($options) && $options !== [] && !in_array($value, $options, true)) {
                    throw new \InvalidArgumentException("Please choose a valid option for {$label}.");
                }
                break;
            case 'date':
                if (strtotime($value) === false) {
                    throw new \InvalidArgumentException("Please enter a valid date for {$label}.");
                }
                break;
        }
    }

    /** @return list<string> */
    private static function parseExtensions(string $raw): array
    {
        $parts = array_values(array_unique(array_filter(array_map(
            static fn (string $e): string => strtolower(trim($e)),
            explode(',', $raw)
        ))));

        return $parts !== [] ? $parts : ['pdf', 'doc', 'docx'];
    }

    private static function normalizeExtensions(string $raw): string
    {
        return implode(',', self::parseExtensions($raw));
    }

    /**
     * @param list<string> $allowedExts
     */
    private static function extensionFromMime(string $mime, array $allowedExts, string $originalName): ?string
    {
        foreach ($allowedExts as $ext) {
            if (isset(self::FILE_MIMES[$ext]) && self::FILE_MIMES[$ext] === $mime) {
                return $ext === 'jpeg' ? 'jpg' : $ext;
            }
        }

        $fromName = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if ($fromName !== '' && in_array($fromName, $allowedExts, true)) {
            return $fromName === 'jpeg' ? 'jpg' : $fromName;
        }

        return null;
    }

    private static function slugify(string $label): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $label) ?? '');
        $slug = trim($slug, '_');
        return $slug !== '' ? $slug : 'field';
    }

    private static function nullIfEmpty(mixed $value): ?string
    {
        $s = trim((string) ($value ?? ''));
        return $s !== '' ? $s : null;
    }

    /**
     * @param list<array<string, mixed>> $fields
     */
    public static function parseFieldsPayload(mixed $raw): array
    {
        if (!is_array($raw)) {
            return self::defaultFieldDefinitions();
        }

        $out = [];
        foreach ($raw as $i => $field) {
            if (!is_array($field)) {
                continue;
            }
            $out[] = [
                'field_key'           => $field['field_key'] ?? '',
                'label'               => $field['label'] ?? '',
                'field_type'          => $field['field_type'] ?? 'text',
                'is_required'         => !empty($field['is_required']),
                'sort_order'          => (int) ($field['sort_order'] ?? ($i + 1)),
                'placeholder'         => $field['placeholder'] ?? null,
                'help_text'           => $field['help_text'] ?? null,
                'options'             => $field['options'] ?? [],
                'max_file_mb'         => (int) ($field['max_file_mb'] ?? 5),
                'accepted_extensions' => $field['accepted_extensions'] ?? 'pdf,doc,docx',
            ];
        }

        return $out !== [] ? $out : self::defaultFieldDefinitions();
    }
}
