<?php

declare(strict_types=1);

use App\Config\Database;
use App\Config\Env;
use App\Helpers\CareerService;
use App\Helpers\Mailer;
use App\Helpers\NotificationService;
use App\Helpers\PlatformFeatures;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$pdo = Database::pdo();
$features = PlatformFeatures::load($pdo);

if (!$features['careers_enabled']) {
    Response::error('Careers are not available at this time.', 404);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') {
    Response::error('Method not allowed.', 405);
}

$jobPostId = (int) ($_POST['job_post_id'] ?? 0);
if ($jobPostId <= 0) {
    Response::error('Please select a job to apply for.', 422);
}

$stmt = $pdo->prepare(
    'SELECT p.id, p.title, p.job_type, p.is_active, r.is_driver AS job_type_is_driver
     FROM job_posts p
     LEFT JOIN job_role_types r ON r.slug = p.job_type
     WHERE p.id = ? LIMIT 1'
);
$stmt->execute([$jobPostId]);
$post = $stmt->fetch();

if ($post === false || !(int) ($post['is_active'] ?? 0)) {
    Response::error('This job is no longer accepting applications.', 404);
}

$jobType = (string) ($post['job_type'] ?? '');
if (CareerService::isDriverRole($pdo, $jobType) && !$features['driver_hiring_enabled']) {
    Response::error('Driver applications are not open at this time.', 403);
}

$fields = CareerService::loadFieldsForPost($pdo, $jobPostId);
if ($fields === []) {
    Response::error('This job is not configured for applications yet.', 422);
}

try {
    $collected = CareerService::validateAndCollectResponses($pdo, $jobPostId, $fields);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    Response::error('Could not process your application. Please try again.', 500);
}

$responses = $collected['responses'];
$summary = $collected['summary'];
$jobTitle = (string) $post['title'];

$user = AuthMiddleware::optional();
$userId = null;
if ($user !== null && ($user['role'] ?? '') === 'customer') {
    $userId = (int) $user['id'];
}

$pdo->beginTransaction();
try {
    $pdo->prepare(
        'INSERT INTO job_applications
            (job_post_id, job_title, user_id, name, email, phone, city, cover_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $jobPostId,
        $jobTitle,
        $userId,
        $summary['name'],
        $summary['email'],
        $summary['phone'],
        $summary['city'],
        $summary['cover_message'],
    ]);

    $applicationId = (int) $pdo->lastInsertId();
    CareerService::saveResponses($pdo, $applicationId, $responses);
    $pdo->commit();
} catch (\Throwable $e) {
    $pdo->rollBack();
    Response::error('Could not save your application. Please try again.', 500);
}

Env::load();
$adminEmail = (string) Env::get('ADMIN_EMAIL', 'admin@danypathmart.store');

$responseLines = array_map(static function (array $r): string {
    if ($r['field_type'] === 'file' && !empty($r['file_name'])) {
        return "{$r['field_label']}: {$r['file_name']} (uploaded)";
    }
    $val = trim((string) ($r['value_text'] ?? ''));
    return "{$r['field_label']}: {$val}";
}, $responses);

Mailer::careerApplicationToAdmin($adminEmail, [
    'id'             => $applicationId,
    'job_title'      => $jobTitle,
    'job_type_label' => CareerService::jobTypeLabel($pdo, $jobType),
    'name'           => $summary['name'],
    'email'          => $summary['email'],
    'phone'          => $summary['phone'],
    'city'           => (string) ($summary['city'] ?? ''),
    'cover_message'  => (string) ($summary['cover_message'] ?? implode("\n", $responseLines)),
    'responses'      => $responses,
]);

NotificationService::notifyAdmins(
    $pdo,
    'Career application — ' . $jobTitle,
    "{$summary['name']} ({$summary['email']}) applied for {$jobTitle}.\n\n" . implode("\n", $responseLines),
    '/admin/career-applications',
    'admin_careers'
);

Response::success([
    'message' => 'Thank you — your application has been submitted. We will be in touch if there is a match.',
    'id'      => $applicationId,
], 201);
