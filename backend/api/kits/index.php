<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\KitBuilderService;
use App\Helpers\Response;

$pdo = Database::pdo();

Response::success(['data' => KitBuilderService::listAll($pdo, true)]);
