<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\SizeGuideService;

$pdo = Database::pdo();
$body = Response::body();

$guideId = (int) ($body['size_guide_id'] ?? 0);
if ($guideId <= 0) {
    Response::error('Size guide id is required.', 422);
}

$guide = SizeGuideService::getById($pdo, $guideId, true);
if ($guide === null) {
    Response::error('Size guide not found.', 404);
}

$chest = isset($body['chest']) && $body['chest'] !== '' ? (float) $body['chest'] : null;
$waist = isset($body['waist']) && $body['waist'] !== '' ? (float) $body['waist'] : null;
$height = isset($body['height']) && $body['height'] !== '' ? (float) $body['height'] : null;

if (($chest === null || $chest <= 0) && ($waist === null || $waist <= 0) && ($height === null || $height <= 0)) {
    Response::error('Enter at least one measurement (chest, waist, or height in cm).', 422);
}

$suggestion = SizeGuideService::suggestSize($guide['rows'], $chest, $waist, $height);

Response::success([
    'suggestion' => $suggestion,
    'guide'      => [
        'id'   => $guide['id'],
        'name' => $guide['name'],
    ],
]);
