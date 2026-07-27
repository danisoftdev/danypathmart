<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LegalPolicyService;
use App\Helpers\Response;

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Policy not found.', 404);
}

$pdo = Database::pdo();
$policy = LegalPolicyService::findPublishedBySlug($pdo, $slug);
if ($policy === null || empty($policy['has_download'])) {
    Response::error('Download not available for this policy.', 404);
}

$rel = null;
$stmt = $pdo->prepare('SELECT attachment_path, attachment_name FROM legal_policies WHERE slug = ? AND is_published = 1 LIMIT 1');
try {
    $stmt->execute([$policy['slug']]);
    $row = $stmt->fetch();
    $rel = $row['attachment_path'] ?? null;
    $name = trim((string) ($row['attachment_name'] ?? '')) ?: basename((string) $rel);
} catch (\Throwable) {
    Response::error('Download not available.', 404);
}

if ($rel === null || $rel === '') {
    Response::error('Download not available.', 404);
}

$abs = dirname(__DIR__, 3) . $rel;
if (!is_file($abs)) {
    Response::error('File missing on server.', 404);
}

$ext = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
$mime = match ($ext) {
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    default => 'application/octet-stream',
};

header('Content-Type: ' . $mime);
header('Content-Length: ' . (string) filesize($abs));
header('Content-Disposition: attachment; filename="' . str_replace('"', '', $name) . '"');
header('Cache-Control: private, max-age=0, must-revalidate');
readfile($abs);
exit;
