<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LocationHelper;
use App\Helpers\Response;

$pdo = Database::pdo();
try {
    $row = $pdo->query(
        'SELECT company_name, email, phone, whatsapp_group, whatsapp_support,
                facebook, instagram, twitter, address, business_hours, return_policy,
                latitude, longitude
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
} catch (\Throwable) {
    $row = $pdo->query(
        'SELECT company_name, email, phone, whatsapp_group, whatsapp_support,
                facebook, instagram, twitter, address, business_hours, return_policy
         FROM company_settings ORDER BY id ASC LIMIT 1'
    )->fetch();
}

// Public payload: deliberately excludes usd_to_ghs_rate, updated_by.
$company = $row !== false ? $row : [
    'company_name'     => 'DanyPathMart',
    'email'            => null,
    'phone'            => null,
    'whatsapp_group'   => null,
    'whatsapp_support' => null,
    'facebook'         => null,
    'instagram'        => null,
    'twitter'          => null,
    'address'          => null,
    'business_hours'   => null,
    'return_policy'    => null,
];

$policy = trim((string) ($company['return_policy'] ?? ''));
$company['return_policy'] = $policy !== '' ? $policy : null;
$company['has_return_policy'] = $company['return_policy'] !== null;

$lat = isset($company['latitude']) ? LocationHelper::parseCoordinate($company['latitude']) : null;
$lng = isset($company['longitude']) ? LocationHelper::parseCoordinate($company['longitude']) : null;
$company['latitude'] = $lat;
$company['longitude'] = $lng;
$company['has_map_pin'] = LocationHelper::hasPin($lat, $lng);
$company['directions_url'] = LocationHelper::hasPin($lat, $lng)
    ? LocationHelper::googleDirectionsUrl($lat, $lng)
    : null;

$analytics = ['enabled' => false, 'measurement_id' => null];
try {
    $ops = \App\Helpers\OpsSettings::load($pdo);
    if ($ops['analytics_enabled'] && $ops['google_analytics_id'] !== null) {
        $analytics = [
            'enabled'        => true,
            'measurement_id' => $ops['google_analytics_id'],
        ];
    }
} catch (\Throwable) {
    // Migration 046 not applied yet.
}

Response::success(['company' => $company, 'analytics' => $analytics]);
