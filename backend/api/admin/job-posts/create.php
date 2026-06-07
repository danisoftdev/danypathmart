<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CareerService;
use App\Helpers\PlatformFeatures;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::requireAny(['manage_careers', 'view_company_settings']);

$pdo = Database::pdo();
$body = Response::body();

$title = trim((string) ($body['title'] ?? ''));
$city = trim((string) ($body['city'] ?? ''));
$jobTypeInput = trim((string) ($body['job_type_label'] ?? $body['job_type'] ?? ''));
$description = trim((string) ($body['description'] ?? ''));
$isActive = !empty($body['is_active']);
$fieldsPayload = CareerService::parseFieldsPayload($body['fields'] ?? null);

if ($title === '') {
    Response::error('Job title is required.', 422);
}
if ($city === '') {
    Response::error('City is required.', 422);
}
if ($description === '') {
    Response::error('Job description is required.', 422);
}

try {
    $role = CareerService::resolveRoleType($pdo, $jobTypeInput);
} catch (\InvalidArgumentException $e) {
    Response::error($e->getMessage(), 422);
}

$features = PlatformFeatures::load($pdo);
if ($role['is_driver'] && !$features['driver_hiring_enabled']) {
    Response::error('Enable driver hiring in Company Settings before posting driver roles.', 422);
}

try {
    $pdo->beginTransaction();
    $pdo->prepare(
        'INSERT INTO job_posts (title, city, job_type, description, is_active) VALUES (?, ?, ?, ?, ?)'
    )->execute([
        $title,
        $city,
        $role['slug'],
        $description,
        $isActive ? 1 : 0,
    ]);

    $id = (int) $pdo->lastInsertId();
    CareerService::syncFields($pdo, $id, $fieldsPayload);
    $pdo->commit();
} catch (\InvalidArgumentException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    Response::error($e->getMessage(), 422);
} catch (\Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    Response::error('Could not create job post.', 500);
}

$cols = CareerService::postsSelectColumns();
$from = CareerService::postsFromJoin();
$stmt = $pdo->prepare("SELECT {$cols} FROM {$from} WHERE p.id = ?");
$stmt->execute([$id]);
$row = $stmt->fetch();

Response::success([
    'message'  => 'Job post created.',
    'job_post' => CareerService::formatJobPost($row ?: [], CareerService::loadFieldsForPost($pdo, $id), $pdo),
], 201);
