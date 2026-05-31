<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$pdo = Database::pdo();
$rows = $pdo->query(
    'SELECT currency_code, currency_name, rate_to_ghs FROM currency_rates ORDER BY currency_code ASC'
)->fetchAll();

$currencies = array_map(static fn (array $r): array => [
    'code'        => $r['currency_code'],
    'name'        => $r['currency_name'],
    'rate_to_ghs' => (float) $r['rate_to_ghs'],
], $rows);

Response::success(['data' => $currencies]);
