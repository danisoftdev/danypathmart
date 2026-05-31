<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\Response;

$dbOk = true;
try {
    Database::pdo()->query('SELECT 1');
} catch (Throwable $e) {
    $dbOk = false;
}

Response::success([
    'status'  => 'ok',
    'service' => 'DanyPathMart API',
    'db'      => $dbOk,
    'time'    => date('c'),
]);
