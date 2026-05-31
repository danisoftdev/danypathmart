<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;
use App\Helpers\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\PermissionMiddleware;

$user = AuthMiddleware::requireAdmin();
PermissionMiddleware::require('edit_company_settings');

$pdo = Database::pdo();
$body = Response::body();

$companyName = trim((string) ($body['company_name'] ?? ''));
if ($companyName === '') {
    Response::error('Company name is required.', 422);
}

$email = trim((string) ($body['email'] ?? ''));
if ($email !== '' && !Validator::email($email)) {
    Response::error('Please enter a valid contact email.', 422);
}

$rate = $body['usd_to_ghs_rate'] ?? 0;
if (!is_numeric($rate) || (float) $rate < 0) {
    Response::error('USD to GHS rate must be a positive number.', 422);
}

$fields = [
    'company_name'     => $companyName,
    'email'            => $email !== '' ? $email : null,
    'phone'            => nullable($body['phone'] ?? null),
    'whatsapp_group'   => nullable($body['whatsapp_group'] ?? null),
    'whatsapp_support' => nullable($body['whatsapp_support'] ?? null),
    'facebook'         => nullable($body['facebook'] ?? null),
    'instagram'        => nullable($body['instagram'] ?? null),
    'twitter'          => nullable($body['twitter'] ?? null),
    'address'          => nullable($body['address'] ?? null),
    'business_hours'   => nullable($body['business_hours'] ?? null),
    'return_policy'    => nullable($body['return_policy'] ?? null),
    'usd_to_ghs_rate'  => (float) $rate,
    'updated_by'       => (int) $user['id'],
];

// Single-row table: always operate on id = 1.
$stmt = $pdo->prepare(
    'INSERT INTO company_settings
        (id, company_name, email, phone, whatsapp_group, whatsapp_support,
         facebook, instagram, twitter, address, business_hours, return_policy,
         usd_to_ghs_rate, updated_by)
     VALUES
        (1, :company_name, :email, :phone, :whatsapp_group, :whatsapp_support,
         :facebook, :instagram, :twitter, :address, :business_hours, :return_policy,
         :usd_to_ghs_rate, :updated_by)
     ON DUPLICATE KEY UPDATE
        company_name = VALUES(company_name),
        email = VALUES(email),
        phone = VALUES(phone),
        whatsapp_group = VALUES(whatsapp_group),
        whatsapp_support = VALUES(whatsapp_support),
        facebook = VALUES(facebook),
        instagram = VALUES(instagram),
        twitter = VALUES(twitter),
        address = VALUES(address),
        business_hours = VALUES(business_hours),
        return_policy = VALUES(return_policy),
        usd_to_ghs_rate = VALUES(usd_to_ghs_rate),
        updated_by = VALUES(updated_by)'
);
$stmt->execute($fields);

Response::success(['message' => 'Company settings saved.', 'settings' => $fields]);

function nullable(mixed $value): ?string
{
    $v = trim((string) ($value ?? ''));
    return $v !== '' ? $v : null;
}
