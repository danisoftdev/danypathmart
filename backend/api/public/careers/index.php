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

$driverHiring = $features['driver_hiring_enabled'];

$cols = CareerService::postsSelectColumns();
$from = CareerService::postsFromJoin();

$sql = "SELECT {$cols} FROM {$from} WHERE p.is_active = 1";
if (!$driverHiring) {
    $sql .= ' AND (r.is_driver IS NULL OR r.is_driver = 0)';
}
$sql .= ' ORDER BY p.created_at DESC';

$rows = $pdo->query($sql)->fetchAll();

$data = array_map(static function (array $r) use ($pdo): array {
    $id = (int) $r['id'];
    $fields = CareerService::loadFieldsForPost($pdo, $id);

    return CareerService::formatJobPost($r, $fields, $pdo);
}, $rows);

Response::success([
    'data'                  => $data,
    'driver_hiring_enabled' => $driverHiring,
    'driver_role_note'      => CareerService::driverRoleNote(),
]);
