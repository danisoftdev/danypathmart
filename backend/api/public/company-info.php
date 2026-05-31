<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$pdo = Database::pdo();
$row = $pdo->query(
    'SELECT company_name, email, phone, whatsapp_group, whatsapp_support,
            facebook, instagram, twitter, address, business_hours
     FROM company_settings ORDER BY id ASC LIMIT 1'
)->fetch();

// Public payload: deliberately excludes usd_to_ghs_rate, return_policy, updated_by.
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
];

Response::success(['company' => $company]);
