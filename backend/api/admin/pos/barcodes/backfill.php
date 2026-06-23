<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\PosBarcodeService;
use App\Helpers\PosGate;
use App\Helpers\Response;
use App\Middleware\AuthMiddleware;

$user = AuthMiddleware::requireAdmin();
$pdo = Database::pdo();
PosGate::assertEnabled($pdo, $user);
PosGate::assertManageConfig($user);

$result = PosBarcodeService::backfillDpmCatalog($pdo);

Response::success([
    'message' => "Assigned barcodes to {$result['updated']} product(s).",
    'data'    => $result,
]);
