<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CareerService;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings', 'hire_employees']);

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Invalid application id.', 422);
}

$pdo = Database::pdo();
$stmt = $pdo->prepare(
    'SELECT a.id, a.job_post_id, a.job_title, a.user_id, a.hired_user_id, a.hired_at,
            a.name, a.email, a.phone, a.city, a.cover_message, a.is_read, a.created_at,
            p.job_type, r.label AS job_type_label
     FROM job_applications a
     LEFT JOIN job_posts p ON p.id = a.job_post_id
     LEFT JOIN job_role_types r ON r.slug = p.job_type
     WHERE a.id = ?
     LIMIT 1'
);
$stmt->execute([$id]);
$row = $stmt->fetch();

if ($row === false) {
    Response::error('Application not found.', 404);
}

$jobType = (string) ($row['job_type'] ?? '');
$responses = CareerService::loadResponsesForApplication($pdo, $id);

Response::success([
    'application' => [
        'id'             => (int) $row['id'],
        'job_post_id'    => $row['job_post_id'] !== null ? (int) $row['job_post_id'] : null,
        'job_title'      => $row['job_title'],
        'job_type'       => $jobType !== '' ? $jobType : null,
        'job_type_label' => $row['job_type_label'] ?? ($jobType !== '' ? CareerService::jobTypeLabel($pdo, $jobType) : null),
        'user_id'        => $row['user_id'] !== null ? (int) $row['user_id'] : null,
        'hired_user_id'  => isset($row['hired_user_id']) && $row['hired_user_id'] !== null ? (int) $row['hired_user_id'] : null,
        'hired_at'       => $row['hired_at'] ?? null,
        'is_hired'       => !empty($row['hired_user_id']),
        'name'           => $row['name'],
        'email'          => $row['email'],
        'phone'          => $row['phone'],
        'city'           => $row['city'],
        'cover_message'  => $row['cover_message'],
        'is_read'        => (bool) $row['is_read'],
        'created_at'     => $row['created_at'],
        'responses'      => $responses,
    ],
]);
