<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\AboutPageService;
use App\Helpers\Response;

$payload = AboutPageService::getPublic(Database::pdo());
Response::success($payload);
