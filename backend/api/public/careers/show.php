<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\CareerService;
use App\Helpers\PlatformFeatures;
use App\Helpers\Response;

$pdo = Database::pdo();
$features = PlatformFeatures::load($pdo);

if (!$features['careers_enabled']) {
    Response::error('Careers are not available at this time.', 404);
}

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    Response::error('Job not found.', 404);
}

$cols = CareerService::postsSelectColumns();
$from = CareerService::postsFromJoin();
$stmt = $pdo->prepare("SELECT {$cols} FROM {$from} WHERE p.id = ? LIMIT 1");
$stmt->execute([$id]);
$row = $stmt->fetch();

if ($row === false || !(int) ($row['is_active'] ?? 0)) {
    Response::error('This job is no longer available.', 404);
}

$jobType = (string) ($row['job_type'] ?? '');
if (CareerService::isDriverRole($pdo, $jobType) && !$features['driver_hiring_enabled']) {
    Response::error('Driver applications are not open at this time.', 403);
}

$fields = CareerService::loadFieldsForPost($pdo, $id);

Response::success([
    'job' => CareerService::formatJobPost($row, $fields, $pdo),
    'driver_role_note' => CareerService::driverRoleNote(),
]);
