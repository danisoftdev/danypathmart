<?php

declare(strict_types=1);

use App\Config\Database;
use App\Helpers\LegalPolicyService;
use App\Helpers\Response;

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('Policy not found.', 404);
}

$pdo = Database::pdo();
$policy = LegalPolicyService::findPublishedBySlug($pdo, $slug);
if ($policy === null) {
    Response::error('Policy not found.', 404);
}

Response::success(['policy' => $policy]);
