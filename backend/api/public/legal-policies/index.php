<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LegalPolicyService;
use App\Helpers\Response;

$pdo = Database::pdo();
Response::success(['data' => LegalPolicyService::listFooter($pdo)]);
