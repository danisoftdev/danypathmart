<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

AuthMiddleware::requireAdmin();
PermissionMiddleware::require('view_company_settings');

$pdo = Database::pdo();
$row = $pdo->query(
    'SELECT id, company_name, email, phone, whatsapp_group, whatsapp_support,
            facebook, instagram, twitter, address, business_hours,
            return_policy, usd_to_ghs_rate, updated_by, updated_at
     FROM company_settings ORDER BY id ASC LIMIT 1'
)->fetch();

$settings = $row !== false ? [
    'id'               => (int) $row['id'],
    'company_name'     => $row['company_name'],
    'email'            => $row['email'],
    'phone'            => $row['phone'],
    'whatsapp_group'   => $row['whatsapp_group'],
    'whatsapp_support' => $row['whatsapp_support'],
    'facebook'         => $row['facebook'],
    'instagram'        => $row['instagram'],
    'twitter'          => $row['twitter'],
    'address'          => $row['address'],
    'business_hours'   => $row['business_hours'],
    'return_policy'    => $row['return_policy'],
    'usd_to_ghs_rate'  => (float) $row['usd_to_ghs_rate'],
    'updated_at'       => $row['updated_at'],
] : [
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
    'usd_to_ghs_rate'  => 0.0,
    'updated_at'       => null,
];

Response::success(['settings' => $settings]);
