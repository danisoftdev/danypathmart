<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\QuoteService;
use App\Helpers\Response;

$pdo = Database::pdo();

Response::success(QuoteService::featureFlags($pdo));
