<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\FlashSaleSettings;
use App\Helpers\Response;

$pdo = Database::pdo();
Response::success(['flash_sale' => FlashSaleSettings::read($pdo)]);
