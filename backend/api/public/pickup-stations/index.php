<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PickupStationService;
use App\Helpers\PlatformFeatures;
use App\Helpers\Response;

$pdo = Database::pdo();

if (!PlatformFeatures::load($pdo)['pickup_stations_enabled']) {
    Response::success(['data' => [], 'enabled' => false]);
}

$region = isset($_GET['region']) ? trim((string) $_GET['region']) : null;
$city = isset($_GET['city']) ? trim((string) $_GET['city']) : null;

Response::success([
    'enabled' => true,
    'data'    => PickupStationService::listPublic($pdo, $region ?: null, $city ?: null),
]);
